# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Demo mode: fire fake events at any widget from the overlay or widget editor, including looping simulators for a moving GPS track and a chat feed. Widgets no longer need their own demo mode.
- Twitch OAuth configured for local development

### Changed
- Dropped legacy app token columns from the database schema

### Fixed
- IRL field widgets never showed live GPS or went offline: the geo frame nests its status inside `payload`, but the consumer read it from the top level
- Auto-bootstrap Twitch app token on fresh deploy
- Missing `auth.users` trigger migrations
- CI build checks and PR workflows

## [0.1.0] - 2025-01-01

### Added
- Initial monorepo setup with REST API, WebSocket server, bot, web app, and overlay apps
- Supabase database pipeline with staging and production migration workflows
- Docker-based build checks for all apps
- Doppler integration for secrets management
- OSS community files (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
