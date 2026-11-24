#!/usr/bin/env python3
"""Two-client membership tests against an already migrated disposable local DB.

PGHOST=/tmp PGPORT=55432 PGUSER=aya PGDATABASE=rofaqa_check2 python3 supabase/tests/concurrency.py
Requires only Python stdlib and psql. Does not contact a Supabase project.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
from threading import Barrier
from uuid import uuid4

if os.environ.get("PGHOST") != "/tmp" or not os.environ.get("PGDATABASE", "").startswith("rofaqa_"):
    raise SystemExit("Use a disposable rofaqa_* database on the /tmp local socket only.")


def sql(command: str):
    result = subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", command],
        check=True, text=True, capture_output=True,
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    return json.loads(lines[-1]) if lines else None


def actor(user_id: str, command: str):
    return sql(f"begin; set local role authenticated; set local \"request.jwt.claim.sub\"='{user_id}'; {command}; commit;")


def together(jobs):
    barrier = Barrier(len(jobs))

    def run(job):
        barrier.wait()
        return job()

    with ThreadPoolExecutor(max_workers=len(jobs)) as executor:
        return list(executor.map(run, jobs))


run_id = uuid4().hex
users = {name: str(uuid4()) for name in (
    "supervisor", "aya", "sara", "shared", "first", "second",
    "inbox_aya", "inbox_sara", "inbox_shared", "inbox_first", "inbox_second",
)}
emails = {name: f"{name}-{run_id}@example.test" for name in users}
for name, user_id in users.items():
    meta = json.dumps({"display_name": name, "is_supervisor": name == "supervisor"})
    sql(f"insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('{user_id}','{emails[name]}',now(),'{meta}')")


def pair(first: str, second: str):
    return actor(users["supervisor"], f"select create_pair('اختبار التزامن','{emails[first]}','{emails[second]}')")


def accept(name: str, token: str):
    return actor(users[name], f"select accept_invitation('{token}')")


def inbox_invitation(name: str, pair_id: str):
    # Test-owner lookup only; the public inbox intentionally omits private pair IDs.
    return sql(
        f"select to_jsonb(id) from invitations where pair_id='{pair_id}' "
        f"and recipient_email='{emails[name]}' and revoked_at is null"
    )


def accept_from_profile(name: str, invitation_id: str):
    return actor(users[name], f"select accept_profile_invitation('{invitation_id}')")


checks = 0
p = pair("aya", "sara")
answers = together([
    lambda: accept("aya", p["invites"][0]["token"]),
    lambda: accept("sara", p["invites"][1]["token"]),
])
assert sorted(answer["status"] for answer in answers) == ["active", "pending"], answers
checks += 1
assert sql(f"select count(*) from pair_members where pair_id='{p['pair']['id']}' and user_id is not null") == 2
checks += 1

answers = together([
    lambda: accept("aya", p["invites"][0]["token"]),
    lambda: accept("aya", p["invites"][0]["token"]),
])
assert [answer["status"] for answer in answers] == ["active", "active"], answers
assert sql(f"select count(*) from pair_members where pair_id='{p['pair']['id']}' and user_id='{users['aya']}'") == 1
checks += 1

left = pair("shared", "first")
right = pair("shared", "second")
assert accept("first", left["invites"][1]["token"])["status"] == "pending"
assert accept("second", right["invites"][1]["token"])["status"] == "pending"
answers = together([
    lambda: accept("shared", left["invites"][0]["token"]),
    lambda: accept("shared", right["invites"][0]["token"]),
])
assert sum(answer.get("status") == "active" for answer in answers) == 1, answers
assert sum("error" in answer for answer in answers) == 1, answers
checks += 1
assert sql(f"select count(*) from pairs p join pair_members m on m.pair_id=p.id where m.user_id='{users['shared']}' and p.status='active'") == 1
checks += 1
assert sql(f"select count(*) from pair_members where user_id='{users['shared']}'") == 1
checks += 1

inbox_pair = pair("inbox_aya", "inbox_sara")
inbox_id = inbox_invitation("inbox_aya", inbox_pair["pair"]["id"])
answers = together([
    lambda: accept_from_profile("inbox_aya", inbox_id),
    lambda: accept("inbox_sara", inbox_pair["invites"][1]["token"]),
])
assert sorted(answer["status"] for answer in answers) == ["active", "pending"], answers
checks += 1
assert sql(f"select count(*) from pair_members where pair_id='{inbox_pair['pair']['id']}' and user_id is not null") == 2
checks += 1

answers = together([
    lambda: accept_from_profile("inbox_aya", inbox_id),
    lambda: accept("inbox_aya", inbox_pair["invites"][0]["token"]),
])
assert [answer["status"] for answer in answers] == ["active", "active"], answers
assert sql(f"select count(*) from pair_members where pair_id='{inbox_pair['pair']['id']}' and user_id='{users['inbox_aya']}'") == 1
checks += 1

inbox_left = pair("inbox_shared", "inbox_first")
inbox_right = pair("inbox_shared", "inbox_second")
assert accept("inbox_first", inbox_left["invites"][1]["token"])["status"] == "pending"
assert accept_from_profile("inbox_second", inbox_invitation("inbox_second", inbox_right["pair"]["id"]))["status"] == "pending"
answers = together([
    lambda: accept_from_profile("inbox_shared", inbox_invitation("inbox_shared", inbox_left["pair"]["id"])),
    lambda: accept("inbox_shared", inbox_right["invites"][0]["token"]),
])
assert sum(answer.get("status") == "active" for answer in answers) == 1, answers
assert sum("error" in answer for answer in answers) == 1, answers
checks += 1
assert sql(f"select count(*) from pairs p join pair_members m on m.pair_id=p.id where m.user_id='{users['inbox_shared']}' and p.status='active'") == 1
checks += 1
assert sql(f"select count(*) from pair_members where user_id='{users['inbox_shared']}'") == 1
checks += 1

print(f"PASS: {checks} two-client concurrency checks; token/profile acceptance, simultaneous activation, idempotent retries, one active membership.")
print("Synthetic fixtures remain only in the disposable local test database.")
