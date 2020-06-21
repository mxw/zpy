-- zpydb cleanup script

DELETE FROM games WHERE ts < NOW() - INTERVAL '2 weeks';
DELETE FROM sessions WHERE ts < NOW() - INTERVAL '3 months';
