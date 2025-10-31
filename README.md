# Cosmic

A modern, self-hostable pastebin built with SvelteKit and PostgreSQL.

![cosmic-example](https://github.com/user-attachments/assets/b97a8734-66ab-439b-9214-1b880ee4a818)

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Authentication & Permissions](#authentication--permissions)
  - [Paste Management](#paste-management)
  - [Backups](#backups)
  - [Security & Performance](#security--performance)
- [Deployment](#deployment)
  - [Docker Deployment (Recommended)](#docker-deployment-recommended)
  - [Manual Deployment](#manual-deployment)
- [Environment Variable Priority](#environment-variable-priority)
- [First-Time Setup & Recovery](#first-time-setup--recovery)
- [Troubleshooting](#troubleshooting)
- [Shoutouts](#shoutouts)
- [License](#license)

## Overview

Cosmic was created to fill a gap I felt personally in this self-hostable pastebin ecosystem. Most existing solutions I could find either lacked a standard authentication system or didn't quite match the aesthetic I was looking for. Inspired by [Spacebin](https://github.com/lukewhrit/spacebin)'s ultra-minimalist design, Cosmic combines that modern simplicity with a authentication system and paste management features.

There is definitely some inefficiencies in the codebase, and awkward inconsistencies (i.e using remote functions in some places, and using actions in others), but I think it's composed together sufficiently enough.

## Tech Stack

[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-000000?style=for-the-badge&logo=betterauth&logoColor=white)](https://www.better-auth.com/)
[![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## Features

### Authentication & Permissions

Role-based access control with three distinct permission levels:

- **Admins** - Full system access including:
  - Admin dashboard with analytics
  - User management (view, create, edit)
  - Global paste management
  - Server configuration settings

- **Users** - Standard authenticated features:
  - Create and manage personal pastes
  - Edit existing pastes with version history
  - Access to all paste customization options

- **Guests** - Limited access (configurable):
  - View public pastes
  - Optional paste creation (admin-controlled)

### Paste Management

- **Syntax Highlighting**
  - Using highlight.js with automatic language detection
  - Client-side language override for custom viewing preferences

- **Customization Options**
  - Expiration time controls
  - Password protection
  - Multiple visibility levels (public, authenticated-only, invite-only, private)
  - Burn after reading
  - Custom URLs

- **Viewing & Sharing**
  - Raw text view
  - Markdown rendered view
  - One-click clipboard copy
  - Download support
  - Fork functionality for authorized users

- **Version Control**
  - Paste versioning system (content only)
  - Configurable version visibility for viewers

### Backups

- Automated backups on cron schedules
- Multiple storage backends:
  - AWS S3
  - Cloudflare R2
  - Local filesystem
- Optional compression

### Security & Performance

- Built-in rate limiting with separate limits for authenticated/unauthenticated users
- Configurable forced expiration windows for paste retention
- Role-based access control throughout

## Deployment

### Docker Deployment (Recommended)

The application includes a complete Docker setup with automatic database initialization. All configuration is handled through environment variables directly in the docker-compose.yml file.

On startup, the application automatically applies any necessary database migrations, ensuring your schema is always up-to-date with the latest version.

#### Quick Start

1. Generate required secrets:

   ```bash
   # Generate database password
   openssl rand -base64 32

   # Generate authentication secret
   openssl rand -base64 32
   ```

2. Edit `docker-compose.yml` and set the required values:

   ```yaml
   environment:
     PUBLIC_WEB_UI_URL: 'https://yourdomain.com'
     DB_PASSWORD: your-generated-password-here
     BETTER_AUTH_SECRET: your-generated-secret-here
   ```

   Save the file.

3. Start the application:

   ```bash
   docker-compose up --build -d
   ```

4. Open your browser and navigate to the URL you set in the `PUBLIC_WEB_UI_URL` environment variable.

### Configuration

**Docker will fail to start** if required variables are undefined.

#### Required Variables

- **`PUBLIC_WEB_UI_URL`** - The public URL where your application will be accessed. This is used for redirects, and authentication callbacks. Examples: `https://yourdomain.com`, `http://192.168.1.100:3000`, `http://localhost:3000`

- **`BETTER_AUTH_SECRET`** - A cryptographically secure random string used for authnetication via Better Auth. **Generate with:** `openssl rand -base64 32`

- **`DB_PASSWORD`** - A secure password for the PostgreSQL database. **Generate with:** `openssl rand -base64 32`

- **`PUBLIC_SITE_NAME`** - The display name shown in throughout the application. Defaults to `"Cosmic"`.

#### Optional Variables (commented out by default)

Uncomment the variables you want to use and modify as needed.

#### Backup Configuration

##### File System Backups

To save database backups to your host machine (the server running Docker, or perhaps a mounted volume), you need to enable it in `docker-compose.yml`. This is optional.

1. **Enable the Volume Mount**: In the `cosmic` service, find the `volumes` section and uncomment the line for backups. This maps a directory on your host to a directory inside the container.

   ```yaml
   volumes:
     # Un-comment this to enable filesystem backups...
     - ./backups:/app/backups
   ```

2. **Enable the Backup Directory Variable**: Under `environment`, uncomment the `BACKUPS_DIRECTORY` variable. Its value must match the path _inside the container_ (the part after the colon `:`) from the volume mount you just enabled.

   ```yaml
   #BACKUPS_DIRECTORY: /app/backups
   ```

   becomes:

   ```yaml
   BACKUPS_DIRECTORY: /app/backups
   ```

   This will save backups to a `backups` folder in the same directory as your `docker-compose.yml` file. You can change `./backups` to any path on your host machine (e.g., `/opt/cosmic/backups`).

##### Cloud Storage (AWS S3)

For automatic backup uploads to AWS S3. **All variables must be set together** (except prefix):

- **`AWS_ACCESS_KEY_ID`** - Your AWS access key
- **`AWS_SECRET_ACCESS_KEY`** - Your AWS secret key
- **`AWS_REGION`** - AWS region (e.g., `us-east-1`)
- **`AWS_S3_BUCKET`** - Your S3 bucket name
- **`AWS_S3_KEY_PREFIX`** - Optional folder prefix (e.g., `"cosmic-backups/"`)

##### Cloud Storage (Cloudflare R2)

For automatic backup uploads to Cloudflare R2. **All variables must be set together** (except prefix):

- **`R2_ACCESS_KEY_ID`** - Your R2 access key
- **`R2_SECRET_ACCESS_KEY`** - Your R2 secret key
- **`R2_ACCOUNT_ID`** - Your Cloudflare account ID
- **`R2_BUCKET_NAME`** - Your R2 bucket name
- **`R2_KEY_PREFIX`** - Optional folder prefix (e.g., `"cosmic-backups/"`)

**Example Configuration:**

```yaml
environment:
  # Required
  DB_PASSWORD: 'your-secure-db-password'
  BETTER_AUTH_SECRET: 'your-secure-auth-secret'
  PUBLIC_WEB_UI_URL: 'https://yourdomain.com'

  # Optional
  AWS_ACCESS_KEY_ID: 'your-aws-key'
  AWS_SECRET_ACCESS_KEY: 'your-aws-secret'
  AWS_REGION: 'us-east-1'
  AWS_S3_BUCKET: 'your-s3-bucket'
```

### Manual Deployment

For manual deployments or development environments:

#### Setup

1. **Copy and configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Set up your PostgreSQL database**
   - You can use the docker-compose.dev.yml, and spin up only the database if you want to run the web-server directly on the host machine by running something like:

```bash
docker compose -p cosmic-dev -f docker-compose.dev.yml up -d db
```

- Or you can use another PostgreSQL instance, just make sure to update the `DB_*` related variables if required.

4. **Run database setup (set env variables before):**

   ```bash
   bun run db:deploy
   ```

5. **Start the application:**

   ```bash
   bun run dev  # for development
   bun run start  # for production
   ```

## Environment Variable Priority

The application follows this priority order for environment variables (top = highest priority):

1. **Docker Compose variables** (directly in docker-compose.yml)
2. **.env file variables** (fallback)
3. **Default values** (built into the application)

## First-Time Setup & Recovery

### Initial Setup

On first run, Cosmic will automatically redirect you to the setup page (`/setup`) where you can:

- Create an administrator account
- View the status of your environment variables
- Configure optional features

The user created during setup will automatically have administrator privileges.

**Username Restrictions:** The following usernames are reserved and cannot be used:

- admin, root, moderator, user, guest, unauthenticated, administrator, owner

### Account Recovery for Self-Hosted Instances

If you forget your admin password or get locked out, you can reset the setup process by one of the two methods:

- **Method 1:** **`FORCE_FIRST_TIME_SETUP`** - Emergency override to force the setup wizard. Set to `true` to reset admin access, then **remove immediately** after use to prevent unauthorized registrations.

  **WARNING**: This will allow anyone to access the setup page while this flag is set to `true`. So make sure to not allow public / unauthorized access to the application while this flag is set. Make sure to remove this flag after you have reset your admin password.
  1. Set the `FORCE_FIRST_TIME_SETUP` environment variable to `true` in your docker-compose.yml or .env file.
  2. Restart the application / docker container.
  3. You'll be redirected to `/setup` on page load.
  4. Create a new admin account - this will a new admin user.
  5. Remove the `FORCE_FIRST_TIME_SETUP` environment variable from your docker-compose.yml or .env file.
  6. Restart the application / docker container.
  7. You can now use the new admin account to change the password of other accounts or whatever else you may need to do.

- **Method 2:** You could also just edit `firstTimeSetupCompleted` to `false` in the settings table of the database directly if you want, this will have the same effect as setting the ENV variable to `true`, until an admin account is created via `/setup`.

## Troubleshooting

If you are getting warnings about database queries and table errors, it is likely that the database has not been initialized. Run `bun run db:deploy` to initialize the database. If you are running through docker, this should automatically happen on container start.

## Shoutouts

- Thanks to [@ajlittle](https://github.com/ajlittle) for idea of autodetect syntax highlight.
- Shoutout to [Spacebin](https://github.com/lukewhrit/spacebin) for inspiration of the minimalist design and style.

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
