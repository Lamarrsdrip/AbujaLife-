import { createServer } from '../src/server/http.mjs';
const port = Number(process.env.PORT || 8787);
const server = createServer();
server.listen(port,'0.0.0.0',()=>console.log(`AbujaLife → http://localhost:${port}`));
