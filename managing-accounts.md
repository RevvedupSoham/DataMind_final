# DataMind — Managing Admin & Member Accounts

A quick reference for adding, changing, or removing login accounts. All of
this happens in the **Supabase SQL Editor** — never in the Table Editor's
"Insert" button, and never in the app's UI (DataMind has no self-signup).

## Why the SQL Editor, and not the Insert button

`admin_users` and `member_users` each store a `password_hash`, not a plain
password. That hash is produced by Postgres's `pgcrypto` extension via
`crypt(password, gen_salt('bf'))`. The Table Editor's Insert button just
stores whatever text you type — it does **not** run that hashing function.
A row added that way will never let anyone log in, because the login check
(`verify_admin_login` / `verify_member_login`) compares the stored value
against a *freshly computed* hash of the typed password, and a plain-text
value will never match.

So: always add or change accounts by running SQL, not by clicking Insert.

---

## Add a new member account

```sql
insert into member_users (username, password_hash)
values ('newusername', crypt('their-password', gen_salt('bf')));
```

## Add a new admin account

```sql
insert into admin_users (username, password_hash)
values ('newusername', crypt('their-password', gen_salt('bf')));
```

**Notes:**
- `username` must be unique within its own table (an admin username and a
  member username *can* coincide, since the two tables are completely
  separate — but it's clearer to avoid that).
- Choose a real password when you insert it — there's no separate "set
  password later" step.

---

## Change an existing account's password

```sql
-- Member:
update member_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'theirusername';

-- Admin:
update admin_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'theirusername';
```

Always double-check the `where` clause matches exactly one row before
running an `update` — an `update` with a `where` that matches nothing
silently does nothing (Supabase will still say "Success"), and one that
matches more rows than intended will overwrite more passwords than you meant to.

---

## Check whether a login will work — before the user tries

```sql
-- Member:
select verify_member_login('theirusername', 'the-password-they-will-type');

-- Admin:
select verify_admin_login('theirusername', 'the-password-they-will-type');
```

Returns `true` if that exact username/password pair would succeed, `false`
otherwise. Handy for confirming a new account or a password change worked
before handing credentials to someone.

---

## View existing accounts (usernames only — hashes aren't reversible)

```sql
select id, username, created_at from admin_users order by created_at desc;
select id, username, created_at from member_users order by created_at desc;
```

There's no way to recover a forgotten password from its hash — hashing is
one-way by design. If someone forgets their password, set a new one with
the `update` command above; you cannot look up or restore the old one.

---

## Remove an account

```sql
-- Member:
delete from member_users where username = 'theirusername';

-- Admin:
delete from admin_users where username = 'theirusername';
```

This only removes their ability to log in. It has no effect on the
`employee`/`department`/etc. application data — those tables are entirely
separate from both login tables.

---

## Rules of thumb

1. **Always use `crypt(password, gen_salt('bf'))`** when writing a
   `password_hash`. Never type or paste a hash value directly, and never
   paste a hash into the login form's password field either.
2. **Admin and member accounts live in separate tables** — `admin_users`
   and `member_users`. There's no shared table and no "promote a member to
   admin" update; to change someone's access level, delete them from one
   table and insert them into the other.
3. **The two demo accounts** (`admin` / `change-me-admin` and `member` /
   `change-me-member`) from initial setup should have their passwords
   changed with the `update` command above before sharing access with
   anyone beyond yourself.
4. **No code or restart needed** for any of this — these are pure data
   changes in Supabase, picked up immediately the next time someone logs
   in. You never need to touch `.env.local`, redeploy, or restart the app
   to add, change, or remove an account.
