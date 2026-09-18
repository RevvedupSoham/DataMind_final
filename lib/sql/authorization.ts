import "server-only";

/**
 * SQL Authorization Layer
 * 
 * This module provides utilities to inject authorization filters into SQL queries
 * based on user role and employee_id. It implements the employee-level access 
 * policies specified in the project requirements.
 * 
 * POLICIES IMPLEMENTED:
 * - POLICY 1 (MEMBER): Individual access only to self
 * - POLICY 2 (MEMBER): Limited aggregate access
 * - POLICY 3 (ADMIN): Hierarchy-based individual access (self + all reports)
 * - POLICY 4 (ADMIN): Hierarchy-based salary access
 * - POLICY 5 (ADMIN): Hierarchy-based address access
 * - POLICY 6 (ADMIN/MEMBER): Limited job_history access (no old_role)
 * - POLICY 7 (ADMIN): Hybrid department-wide access
 * - POLICY 8 (MEMBER): Own department + approved general department info
 * - POLICY 10: REJECT unauthorized queries (don't silently filter)
 */

export interface AuthorizationContext {
  role: "admin" | "member";
  employeeId: number;
  hierarchyIds?: number[]; // For admin: all employee IDs in their hierarchy
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  requiresHierarchyCheck?: boolean;
}

/**
 * Analyzes a SQL query to determine if it accesses sensitive individual data
 */
export function analyzeSqlForSensitiveAccess(sql: string): {
  accessesEmployee: boolean;
  accessesSalary: boolean;
  accessesAddress: boolean;
  accessesJobHistory: boolean;
  accessesOldRole: boolean;
  isAggregate: boolean;
  hasWhereClause: boolean;
  hasEmployeeIdFilter: boolean;
} {
  const sqlLower = sql.toLowerCase();
  
  // Check which tables are accessed
  const accessesEmployee = /\bfrom\s+employee\b|\bjoin\s+employee\b/i.test(sqlLower);
  const accessesSalary = /\bfrom\s+salary\b|\bjoin\s+salary\b/i.test(sqlLower);
  const accessesAddress = /\bfrom\s+address\b|\bjoin\s+address\b/i.test(sqlLower);
  const accessesJobHistory = /\bfrom\s+job_history\b|\bjoin\s+job_history\b/i.test(sqlLower);
  
  // Check if old_role is selected from job_history (POLICY 6)
  const accessesOldRole = accessesJobHistory && /\bold_role\b/i.test(sqlLower);
  
  // Check if it's an aggregate query
  const isAggregate = /\b(count|sum|avg|max|min|group\s+by)\s*\(/i.test(sqlLower) ||
                      /\bgroup\s+by\b/i.test(sqlLower);
  
  // Check for WHERE clause
  const hasWhereClause = /\bwhere\b/i.test(sqlLower);
  
  // Check if employee.id or employee_id is filtered
  const hasEmployeeIdFilter = /\bemployee\.id\s*=|\bemployee_id\s*=/i.test(sqlLower);
  
  return {
    accessesEmployee,
    accessesSalary,
    accessesAddress,
    accessesJobHistory,
    accessesOldRole,
    isAggregate,
    hasWhereClause,
    hasEmployeeIdFilter
  };
}

/**
 * Validates if a MEMBER can execute the given query
 * POLICY 1: Members can only access their own individual data
 * POLICY 2: Members have limited aggregate access (no salary stats)
 * POLICY 8: Members can see their own department info
 */
export function validateMemberAccess(
  sql: string,
  employeeId: number
): AuthorizationResult {
  const analysis = analyzeSqlForSensitiveAccess(sql);
  
  // POLICY 6: Block old_role for everyone including members
  if (analysis.accessesOldRole) {
    return {
      authorized: false,
      reason: "The old_role field in job_history is restricted. You can access new_role and changed_on for your own records only."
    };
  }
  
  // Check if accessing sensitive individual data
  const accessesSensitiveData = 
    analysis.accessesEmployee || 
    analysis.accessesSalary || 
    analysis.accessesAddress || 
    analysis.accessesJobHistory;
  
  if (accessesSensitiveData) {
    if (analysis.isAggregate) {
      // POLICY 2: Aggregates - allow general ones, block salary statistics
      if (analysis.accessesSalary && /\b(sum|avg|max|min)\s*\(\s*.*\bamount\b/i.test(sql.toLowerCase())) {
        return {
          authorized: false,
          reason: "Members cannot access salary statistics. This query requires admin access."
        };
      }
      // Allow other aggregates (employee counts, department counts, etc.)
      return { authorized: true };
    } else {
      // POLICY 1 & POLICY 10: Individual access must specify employee ID
      // Don't silently filter - reject if not properly scoped
      if (!analysis.hasEmployeeIdFilter) {
        return {
          authorized: false,
          reason: `Members can only access their own employee information. Please specify your employee ID (${employeeId}) in the query.`
        };
      }
      // Query has employee ID filter - allow it (DB will enforce the actual ID)
      // The application should ensure the filter matches the user's employeeId
      return { 
        authorized: true,
        requiresHierarchyCheck: false
      };
    }
  }
  
  // Non-sensitive queries (department metadata, etc.) are allowed
  return { authorized: true };
}

/**
 * Validates if an ADMIN can execute the given query
 * POLICY 3: Admins have hierarchy-based access (self + all reports)
 * POLICY 4: Salary access within hierarchy
 * POLICY 5: Address access within hierarchy
 * POLICY 6: Limited job_history (no old_role)
 * POLICY 7: Hybrid department-wide access
 */
export function validateAdminAccess(
  sql: string,
  employeeId: number
): AuthorizationResult {
  const analysis = analyzeSqlForSensitiveAccess(sql);
  
  // POLICY 6: Block old_role for everyone including admins
  if (analysis.accessesOldRole) {
    return {
      authorized: false,
      reason: "The old_role field in job_history is restricted. You can access new_role and changed_on for employees in your hierarchy."
    };
  }
  
  // Check if accessing sensitive individual data
  const accessesSensitiveData = 
    analysis.accessesSalary || 
    analysis.accessesAddress || 
    (analysis.accessesEmployee && !analysis.isAggregate);
  
  if (accessesSensitiveData) {
    // POLICY 10: Don't allow unrestricted queries even for admins
    // Require WHERE clause for individual data access
    if (!analysis.hasWhereClause) {
      return {
        authorized: false,
        reason: "Admin access to individual employee data requires specifying which employees. Add a WHERE clause to filter by employee."
      };
    }
    
    // Query has WHERE clause - needs hierarchy check at execution time
    // The database function will verify employee IDs are in admin's hierarchy
    return { 
      authorized: true,
      requiresHierarchyCheck: true
    };
  }
  
  // Aggregates and department queries are generally allowed for admins
  // POLICY 7: Department-wide approved queries are allowed
  return { authorized: true };
}

/**
 * Main authorization validator
 * Returns whether the query is authorized and any error reason
 */
export function validateQueryAuthorization(
  sql: string,
  context: AuthorizationContext
): AuthorizationResult {
  if (context.role === "member") {
    return validateMemberAccess(sql, context.employeeId);
  } else if (context.role === "admin") {
    return validateAdminAccess(sql, context.employeeId);
  }
  
  return {
    authorized: false,
    reason: "Unknown role. Authorization check failed."
  };
}

/**
 * Detects if a query is trying to access data outside the user's scope
 * This is a defense-in-depth check that runs after SQL generation
 */
export function detectUnauthorizedAccess(
  sql: string,
  context: AuthorizationContext
): { 
  isUnauthorized: boolean; 
  reason?: string;
} {
  const sqlLower = sql.toLowerCase();
  
  // Check for attempts to access auth tables
  if (/\b(admin_users|member_users)\b/i.test(sqlLower)) {
    return {
      isUnauthorized: true,
      reason: "Authentication tables cannot be queried through DataMind."
    };
  }
  
  // Check for password-related columns
  if (/\bpassword/i.test(sqlLower)) {
    return {
      isUnauthorized: true,
      reason: "Password information cannot be accessed through queries."
    };
  }
  
  return { isUnauthorized: false };
}
