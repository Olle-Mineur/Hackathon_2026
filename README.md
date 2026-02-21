# 🚌 Ride the Bus (Hackathon 2026) 🚌

Meet Emil. Emil lives at 10.216 and absolutely loves playing games.

Whether it's a quiet Tuesday or a rowdy weekend, Emil is always looking for ways to entertain his friends. But there was one problem: every time they wanted to play the classic card game "Ride the Bus", someone had spilled a drink on the cards, or the deck was missing the 7 of Spades.

So, Emil did what any reasonable person at 10.216 would do. He built a real-time, multiplayer web version of the game.

## Emil's Features

- **Real-time Multiplayer:** Emil hates lag, so he used WebSockets to ensure instant game state synchronization across all his friends' phones.
- **Human-Readable Lobbies:** Nobody wants to type a UUID after a few drinks. Emil made sure lobby codes are memorable (e.g., `BRAVE-PANDA-JUMPS`).
- **Role-based Views:**
  - **Host View:** Emil puts this on his big TV. It shows the main game board, current cards, and who is ready.
  - **Player View:** A mobile-friendly interface for his friends to submit their guesses (Red/Black, Higher/Lower, etc.) from the couch.
- **Robust State Management:** Redis-backed session storage with Pub/Sub, because Emil's game nights can get intense and the server needs to scale.
- **Auto-Cleanup:** Lobbies automatically close after periods of inactivity, so Emil doesn't wake up to a crashed server.

## What Emil Used (Tech Stack)

**Frontend:**

- [Astro](https://astro.build/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

**Backend:**

- [Go 1.25](https://go.dev/)
- [Gorilla WebSockets](https://github.com/gorilla/websocket)
- [Redis](https://redis.io/) (State Store & Pub/Sub Bus)

**Infrastructure:**

- Docker & Docker Compose
- GitHub Actions (CI/CD with Self-Hosted Runner)

## Play Emil's Game (Local Development)

Want to host your own game night like Emil? You just need [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

1. Clone the repository:
   ```sh
   git clone https://github.com/yourusername/Hackathon_2026.git
   cd Hackathon_2026
   ```
2. Start the development environment (including Redis):
   `docker compose -f docker-compose.dev.yml up --build`
3. Open your browser:
   Frontend: http://localhost:4321
   Backend API: http://localhost:3000

## How Emil Deploys (CI/CD)

Emil runs a home server behind a Cloudflare Tunnel. To keep things secure, he uses **GitHub Actions** combined with a **Self-Hosted Runner**.

1. **Test Job:** Runs on GitHub's secure cloud runners (ubuntu-latest) to build the frontend and test the Go backend.
2. **Deploy Job:** Runs on Emil's self-hosted runner. It is protected by:
   - **GitHub Environments:** Requires Emil's manual approval before deploying to 10.216.
   - **Branch Protection:** Only triggers on pushes to the main branch.
