import { handleRequest } from '../../backend/api.js';
export function onRequest({ request, env, waitUntil }) { return handleRequest(request, env,{waitUntil}); }
