# Massive Recoil Devlog

A gamedev devlog backend. Built with Bun and Elysia.

This project is designed to run in Docker only. There is no local runtime setup — Docker is the only prerequisite.

## Running

```bash
cp .env.example .env  # fill in the values
bash scripts/start.sh
```

`start.sh` builds the image, starts the container detached, and follows the logs. Press Ctrl+C to stop and tear down cleanly.

## Contributing

After cloning, install the git hooks so Biome runs on every commit:

```bash
bun install
bash scripts/setup-hooks.sh
```
