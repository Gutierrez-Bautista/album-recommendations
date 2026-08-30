# Daily Album

A personal web app that recommends one album a day from a manually curated collection, with Spotify integration to help expand your music library.

## About

Daily Album is designed to make discovering full albums a small, consistent daily habit. Instead of generating recommendations automatically, the app selects from a collection of albums added manually by the user through their Spotify URLs or IDs.

The initial version is intended for personal use and focuses on a simple workflow: add albums, receive one recommendation per day, and decide whether to listen to or save it on Spotify.

This is also a learning project created as a way to return to regular software development and explore the design of a small production-oriented application.

## How it works

1. The user adds an album using its Spotify URL or ID.
2. The app retrieves and stores the available album metadata.
3. One eligible album is selected as the recommendation for the day.
4. The user can open the album on Spotify and keep track of previous recommendations.

The app does **not** automatically save albums to the user's Spotify library in its initial version. A configuration option for automatic saving is reserved for possible future development.

## Planned features

- Manual album collection management using Spotify URLs or IDs
- One album recommendation per day
- Spotify metadata synchronization
- Album information such as artists, release date, artwork, track count, genres, and classifications where available
- Recommendation history to prevent unintended repeats
- Direct links to albums on Spotify
- Settings prepared for future features such as automatic library saving

## Initial scope

The first version is a single-user application built primarily for personal use. Multi-user support, social features, and shared collections are outside the initial scope, although limited support for a small number of additional users may be considered later.

## Project status

This project is currently in early development.

- [ ] Create the application scaffold
- [ ] Implement the database schema
- [ ] Integrate the Spotify Web API
- [ ] Add album ingestion by URL or ID
- [ ] Implement the daily selection logic
- [ ] Build the recommendation and history interfaces
- [ ] Add optional automatic saving to Spotify

Setup and development instructions will be added once the initial application scaffold is available.

## Spotify API

This project uses the [Spotify Web API](https://developer.spotify.com/documentation/web-api) to retrieve album information and link recommendations back to Spotify.

Any application displaying Spotify metadata or artwork must comply with Spotify's [Developer Policy](https://developer.spotify.com/policy) and [Design and Branding Guidelines](https://developer.spotify.com/documentation/design).

## Third-party content and trademarks

The MIT License applies only to the original source code contained in this repository.

Spotify names, logos, trademarks, album artwork, artist images, metadata, and other content supplied through the Spotify Platform are the property of Spotify AB and/or their respective rights holders. Such materials are not covered by this project's MIT License, and their use is subject to Spotify's applicable terms and guidelines.

This project is an independent application and is not affiliated with, sponsored by, or endorsed by Spotify.

## License

The original source code in this repository is licensed under the [MIT License](LICENSE).
