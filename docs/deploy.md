# Production deployment — markbuhayeu.com

The workflow builds Astro with Node 24, runs tests, checks the static output and authenticates through SFTP on port 22 using a pinned known_hosts entry. It only publishes dist/ to the approved document root. No SSH shell or rsync is required.

Repository secrets: SFTP_HOST, SFTP_PORT, SFTP_USERNAME, SFTP_REMOTE_DIR, SFTP_KNOWN_HOSTS and exactly one of SFTP_PASSWORD or SFTP_PRIVATE_KEY.

First run is preflight-only unless the repository Actions variable SFTP_DEPLOY_ENABLED is set to true. Check the SFTP preflight log, independently verify the server host key against hoster.by, and confirm the ispmanager document root. If the SFTP chroot hides the full path, place a file called .technoyasno-deploy-target in the actual document root containing exactly markbuhayeu.com.

After these checks, enable production by creating the Actions repository variable SFTP_DEPLOY_ENABLED=true. Manually run the workflow on main in deploy mode. Subsequent pushes to main deploy automatically.

Before uploading, the script creates a private, checksum-verified backup of the current document root in the SFTP home directory .technoyasno-backups, outside the public site. If no such private location is accessible, or the site has symlinks, make and verify a backup in ispmanager and use a manual run with backup_confirmed enabled. Do not enable unattended deployment if a private automatic backup is impossible.

The workflow never mirrors with deletion. Existing unrelated files are preserved, including PHP and hosting configuration. Obsolete files may remain and must be reviewed manually. Uploads are individually renamed into place, not an atomic whole-site switch. The release marker and HTTPS homepage are checked after publication.

Rollback: disable SFTP_DEPLOY_ENABLED. Use ispmanager to restore the desired verified backup into the confirmed document root; inspect and remove only files introduced by the failed release if necessary. For a source-code rollback, revert the relevant commits on main, re-enable production after verification, and deploy again. Do not restore files into other websites.
