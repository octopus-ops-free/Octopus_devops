from __future__ import annotations

from app.services.cron_summary import count_crontab_lines, parse_cron_journal_text


def test_count_crontab_lines_ignores_comments_and_blank():
    text = """
# m h dom mon dow command
*/5 * * * * /bin/true

0 * * * * /opt/job.sh
"""
    assert count_crontab_lines(text) == 2


def test_parse_cmdend_exit_zero_success():
    text = "May  2 10:00:01 host CRON[123]: (root) CMDEND (/bin/run.sh; exit status 0)"
    out = parse_cron_journal_text(text)
    assert out["success"] == 1
    assert out["failure"] == 0
    assert out["skipped"] == 0


def test_parse_cmdend_nonzero_failure_and_skip_keyword():
    text = """May  2 10:00:01 host CRON[1]: (CRON) info (Skipping @hourly job)
May  2 10:00:02 host CRON[2]: (root) CMDEND (/bin/bad.sh; exit status 1)
"""
    out = parse_cron_journal_text(text)
    assert out["skipped"] >= 1
    assert out["failure"] == 1
