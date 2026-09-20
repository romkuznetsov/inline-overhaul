# Security policy

## What this plugin touches

inlineOverhaul runs inside Obsidian on your own machine and edits notes in your vault.
It is worth being precise about the boundaries, because that is what a security report
should be measured against:

- **It makes no network requests.** Nothing is sent anywhere, there is no telemetry, no
  analytics and no remote service.
- **It writes inside your vault only** — the notes you act on, its own settings file,
  its language files, and backups where you told it to put them.
- **Transform writes new notes and can clean up the source line.** It is off by default
  and stays off until you turn on both the Transform module and
  **Transform inline to note**.
- **Developer mode can write logs** to a vault-relative path you choose. Those logs may
  contain the text of lines involved in commands. It is off by default.

A plugin that did any of this differently would be violating Obsidian's developer
policies; if you find that it does, that is exactly the kind of report this page is for.

## Supported versions

The newest release only. The plugin is in public beta and there is no back-porting.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:

**[Report a vulnerability](https://github.com/romkuznetsov/inline-overhaul/security/advisories/new)**

If that is unavailable to you, open an issue that says only that you have a security
report and asks for a contact — no details.

Useful in a report:

- what an attacker can do, and what they need to already have in order to do it;
- the smallest reproduction you can manage — a note, a setting, a sequence;
- the plugin and Obsidian versions from **Advanced → Diagnostics**.

## What happens next

Expect an acknowledgement within a week — this is one person's side project, not a
staffed programme, and it is better to say that plainly than to promise a schedule that
will not be kept. A confirmed issue gets a fix in the next release and an entry in the
`Security` section of the changelog, with credit unless you ask otherwise.

## Out of scope

- Data loss caused by Transform or by editing settings, when the plugin behaved as
  documented — that is a bug or a documentation defect, and belongs in a normal issue.
- Vulnerabilities in Obsidian itself — report those to
  [Obsidian](https://obsidian.md/security).
- Vulnerabilities in other plugins, even when they surface while inlineOverhaul is
  installed.
