# Fullstack Node App

## Overview
This project is an AI-driven legal document automation platform designed specifically for Uzbekistan. It leverages modern web technologies to provide a seamless experience for users looking to automate legal documentation processes.

## Project Structure

The project is organized into several key directories and files:

- **src/**: Contains the main application source code, including components, hooks, services, and utilities.
- **server/**: Houses server-side code, including service logic and API endpoints.
- **dist/**: The build output directory for production-ready assets.
- **test/**: Contains test scripts and related resources.
- **config files**: Includes configuration files such as `.env.example`, `.gitignore`, `.prettierrc`, `eslint.config.js`, `postcss.config.js`, `tailwind.config.js`, and `tsconfig.json`.

## Installation

To set up the project locally, follow these steps:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd fullstack-node-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables by copying `.env.example` to `.env` and filling in the required values.

## Development

To start the development server, run:
```bash
npm run dev
```
This will concurrently start both the client and server development environments.

## Building

To build the project for production, use:
```bash
npm run build
```
This command compiles both client and server code into the `dist/` directory.

## Testing

The project includes several testing phases with detailed reports:

- **Manual Testing Guide**: Refer to `MANUAL-TESTING-GUIDE.md` for manual testing procedures.
- **Phase 1 & 2 Testing**: Automated test results and reports are available in files like `PHASE1-TEST-REPORT.md`, `PHASE2-TEST-REPORT.md`, etc.

To run all tests, execute:
```bash
npm run test
```

## Linting and Formatting

Ensure code quality and consistency by running:
```bash
npm run lint
npm run format
```

## Contribution Guidelines

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.

## License

This project is licensed under the MIT License.