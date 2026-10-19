# Daily Album

A personal web application that recommends one album a day from a manually curated collection, with Spotify integration to help expand your music library.

## About

Daily Album is designed to make discovering full albums a small, consistent daily habit.

Rather than generating recommendations through Spotify's algorithms or AI, the application selects albums from a manually curated catalog. Spotify provides album metadata, artwork, authentication, and links to the original releases.

The initial version is primarily intended for personal use, with an administrative interface for managing the catalog and a public experience for discovering albums.

This is also a learning project focused on building a small, maintainable, production-oriented web application.

**Project status:** Under active development. Authentication and catalog management are implemented; daily recommendations and recommendation history are still pending.

## How it works

The intended workflow is:

1. An administrator imports an album using its Spotify URL or ID.
2. The application retrieves the available Spotify metadata and stores the album in its catalog.
3. The administrator can assign a release classification and descriptive tags.
4. The application selects one eligible album as the daily recommendation.
5. Visitors can explore the recommended album and open it on Spotify.
6. Previous recommendations are recorded to avoid unintended repeats.

Steps 1–3 are currently implemented. The daily recommendation and history functionality are planned for the next development stages.

Daily Album does not automatically save albums to a user's Spotify library in its initial version.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4
- **Authentication:** Better Auth with Spotify OAuth
- **Database:** PostgreSQL on Neon
- **ORM and migrations:** Drizzle ORM and Drizzle Kit
- **Validation:** Zod
- **Testing:** Vitest
- **Package manager:** pnpm (see the `packageManager` field in `package.json` for the exact version)

## Getting started

### Prerequisites

Before running the application locally, you will need:

- Node.js and the pnpm version specified by the project.
- A PostgreSQL database, preferably hosted on Neon.
- A Spotify Developer application with a Client ID and Client Secret.

For local Spotify authentication, register the following redirect URI in your Spotify Developer Dashboard:

`http://127.0.0.1:3000/api/auth/callback/spotify`

Spotify does not permit `http://localhost` as an OAuth redirect URI. Use the explicit loopback address `127.0.0.1`.

### 1. Clone and install dependencies

```bash
git clone https://github.com/Gutierrez-Bautista/album-recommendations.git
cd album-recommendations
pnpm install --frozen-lockfile
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholders with your local configuration.

The application uses the following variables:

| Variable                  | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string for your Neon database |
| `BETTER_AUTH_URL`         | Application base URL used by Better Auth            |
| `BETTER_AUTH_SECRET`      | Secure secret used by Better Auth                   |
| `SPOTIFY_CLIENT_ID`       | Client ID from the Spotify Developer Dashboard      |
| `SPOTIFY_CLIENT_SECRET`   | Client Secret from the Spotify Developer Dashboard  |
| `CURRENT_TERMS_VERSION`   | Current Terms and Conditions version identifier     |
| `CURRENT_PRIVACY_VERSION` | Current Privacy Policy version identifier           |

For local development, set:

```env
BETTER_AUTH_URL=http://127.0.0.1:3000
```

Use a securely generated value for `BETTER_AUTH_SECRET`.

The legal document version identifiers are used to determine whether a user needs to accept the current Terms and Conditions and acknowledge the Privacy Policy.

**Never commit real credentials or environment files.** `.env*` files are ignored by Git, except for `.env.example`.

### 3. Set up the database

The database schema is defined in `src/db/schema/`, and existing SQL migrations are stored in `drizzle/`.

Apply the existing migrations:

```bash
pnpm exec drizzle-kit migrate
```

To populate the initial tag categories and tags, run:

```bash
pnpm db:seed
```

The seed uses `.env` to load the database connection and upserts the predefined categories and tags.

These commands modify the configured database. Use a development database and verify `DATABASE_URL` before running them.

### 4. Start the development server

```bash
pnpm dev
```

Open:

`http://127.0.0.1:3000`

Use this address consistently when testing Spotify authentication.

### 5. Access the administration interface

New Spotify accounts receive the `user` role by default.

Administrative access requires an account with the `admin` role. The application does not currently provide a public interface for granting administrative privileges.

For local development:

1. Sign in using an authorized Spotify account.
2. Complete the legal acceptance flow.
3. Assign the `admin` role to the intended account using a trusted database administration tool.
4. Access `/admin/albums` to import albums.

The existing album editing interface is available at `/admin/albums/[albumId]`.

Do not expose administrative role assignment through a public, unauthenticated endpoint.

## Development commands

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Start the Next.js development server          |
| `pnpm build`          | Create a production build                     |
| `pnpm start`          | Start the production server after building    |
| `pnpm lint`           | Run ESLint                                    |
| `pnpm run type:check` | Check TypeScript types without emitting files |
| `pnpm test`           | Run the Vitest test suite                     |
| `pnpm test:watch`     | Run Vitest in watch mode                      |
| `pnpm test:coverage`  | Generate a test coverage report               |
| `pnpm db:seed`        | Populate the predefined tag taxonomy          |

Drizzle migration commands are executed through Drizzle Kit rather than a dedicated package script.

## Project structure

```text
app/                 Next.js App Router pages, layouts and actions
  admin/albums/      Administrative album import and editing
  api/auth/          Better Auth API handler
components/          Reusable interface components
lib/
  catalog/           Catalog operations, queries and domain errors
  spotify/           Spotify Web API integration
src/db/
  schema/            Drizzle database schema
drizzle/             Database migrations
scripts/             Administrative and seeding scripts
tests/               Shared test fixtures and mocks
public/              Static assets
```

Most unit tests are colocated with the modules they test using the `*.test.ts` naming convention.

## Project status

### Completed

- [x] Create the application scaffold
- [x] Implement the initial database schema
- [x] Integrate the Spotify Web API
- [x] Implement Spotify authentication and legal acceptance
- [x] Add album ingestion by Spotify URL or ID
- [x] Implement album metadata preview and catalog import
- [x] Implement album classification editing and tag assignment

### MVP — remaining work

- [ ] Implement the daily album selection logic
- [ ] Build the daily recommendation interface
- [ ] Implement recommendation history and repeat prevention
- [ ] Build public album details and history views
- [ ] Complete navigation and final MVP integration

### Possible future improvements

- Spotify metadata synchronization and refresh
- Administrative tag creation, editing and deletion
- Personal album tracking and listening history
- Additional recommendation filters and user preferences
- Optional automatic saving to Spotify, subject to the required authorization and platform policies

These improvements are not required for the initial MVP.

## Spotify API

Daily Album uses the [Spotify Web API](https://developer.spotify.com/documentation/web-api) for album metadata and Spotify integration.

The application uses server-side Client Credentials for public album metadata and Better Auth for user authentication.

The existing catalog stores metadata retrieved from Spotify. Metadata refresh and retention behavior will require further review before broader public deployment to ensure continued compliance with Spotify's applicable terms.

Relevant resources:

- [Spotify Web API documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Developer Policy](https://developer.spotify.com/policy)
- [Spotify Developer Terms](https://developer.spotify.com/terms)
- [Spotify Design and Branding Guidelines](https://developer.spotify.com/documentation/design)

## Contributing and development guidelines

Project-wide development conventions and instructions for AI coding agents are defined in [`AGENTS.md`](AGENTS.md).

Contributions should follow the existing architecture, preserve application-specific classifications independently of Spotify metadata, and include relevant tests.

Changes to authentication, database schemas, external API usage, or dependencies should be reviewed carefully before implementation.

## Third-party content and trademarks

The MIT License applies only to the original source code contained in this repository.

Spotify names, logos, trademarks, album artwork, artist images, metadata, and other content supplied through the Spotify Platform are the property of Spotify AB and/or their respective rights holders. Such materials are not covered by this project's MIT License, and their use is subject to Spotify's applicable terms and guidelines.

This project is an independent application and is not affiliated with, sponsored by, or endorsed by Spotify.

## License

The original source code in this repository is licensed under the [MIT License](LICENSE).
