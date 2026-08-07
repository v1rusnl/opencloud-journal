# Security Policy

## Security considerations

OpenCloud Journal is a client-side web application that connects to OpenCloud
and accesses CalDAV resources.

Please be aware of the following security considerations:

### App token storage

The application uses an OpenCloud app token for CalDAV access.

The token is temporarily stored in the browser's `localStorage` so it can be
reused across page reloads and browser tabs. The token has a limited lifetime
and is recreated when required.

Because `localStorage` can be accessed by JavaScript running on the same
origin, a successful Cross-Site Scripting (XSS) attack against the OpenCloud
web interface could potentially expose this token.

For this reason, OpenCloud Journal does not intentionally render untrusted
HTML from journal entries, notes or tasks. Content received through CalDAV
should always be treated as untrusted input.

### Transport security

CalDAV authentication uses the OpenCloud app token as credentials.

OpenCloud Journal should therefore only be used with OpenCloud installations
served over HTTPS. Using the application over an unencrypted HTTP connection
may expose authentication credentials and private journal data.

### Browser security

The security of OpenCloud Journal also depends on the security of the
OpenCloud web environment in which it is loaded.

Administrators should keep OpenCloud, the reverse proxy and the web browser
up to date and use appropriate security headers such as a Content Security
Policy (CSP) where possible.

### Third-party dependencies

OpenCloud Journal uses third-party JavaScript packages.

Dependencies are locked through the package lock file, but vulnerabilities
may still be discovered in these packages. Repository maintainers should
regularly review dependency updates and security advisories.

### CalDAV data

Journal entries, notes and tasks may contain private information. Their
confidentiality depends on the security and access controls of the connected
OpenCloud/CalDAV installation.

OpenCloud Journal does not provide additional end-to-end encryption for
CalDAV data.


## Reporting a security issue

If you discover a security issue that is not mentioned above, please do not publish sensitive details,
credentials or app tokens in a public GitHub issue.

Please report the problem privately whenever possible.

Never include real passwords, access tokens, app tokens or private CalDAV
content in a security report.


## Supported Versions
The table below details which versions of this project are currently receiving security updates.

| Version | Supported          |
| ------- | ------------------ |
| latest   | :white_check_mark: |


## Reporting a Vulnerability
Please do not report security vulnerabilities via public GitHub issues. 

Instead, report vulnerabilities securely using one of the following methods:
* **Private Vulnerability Reporting**: Go to the "Security" tab of this repository, click "Advisories", and select "Report a vulnerability".

Please include a clear description of the issue, step-by-step reproduction instructions, and a minimal proof-of-concept (PoC).
