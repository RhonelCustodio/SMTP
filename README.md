# Feedback website deployment

The frontend is a static page and can be hosted on GitHub Pages. The Node.js
backend must be deployed separately because GitHub Pages cannot run `server.js`.

## Deploy the API

1. Push this project to a GitHub repository. Keep `.env` out of Git; never put
   `RESEND_API_KEY` in `index.html`.
2. Create a Render Web Service connected to the repository.
3. Use `npm start` as the start command. Render supplies the `PORT` variable.
4. Add these environment variables to the Render service:

   - `RESEND_API_KEY`: your Resend API key.
   - `RESEND_FROM_EMAIL`: a sender address on a domain verified in Resend, for
     example `Feedback <feedback@your-verified-domain.com>`.
   - `FRONTEND_ORIGIN`: the exact GitHub Pages origin, for example
     `https://username.github.io`. For multiple trusted origins, separate them
     with commas. Do not include a repository path or trailing slash.

5. Deploy and copy the service's HTTPS origin, for example
   `https://your-service.onrender.com`.

## Deploy the frontend

1. In `index.html`, set `API_BASE_URL` to the deployed backend origin, without a
   trailing slash:

   ```js
   const API_BASE_URL = 'https://your-service.onrender.com';
   ```

2. Push the change to GitHub.
3. In the repository, open **Settings → Pages**, select the branch and folder
   containing `index.html`, then save.
4. Open the published Pages URL and submit a test response.

For local development, leave `API_BASE_URL` as an empty string and run
`node --env-file=.env server.js`, then open `http://localhost:3000`.
