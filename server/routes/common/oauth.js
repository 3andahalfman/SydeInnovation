const { AuthClientTwoLegged, AuthClientThreeLegged } = require('forge-apis');
const config = require('../../config');

// Tokens are auto-refreshed, keeping clients in simple cache
let cache = {};

// 3-legged token storage (per user session)
let userTokens = {};

// Since we got 3 calls at the first page loading, let's initialize this one now,
// to avoid concurrent requests.
getClient (/*config.scopes.internal*/);

/**
 * Initializes a Forge client for 2-legged authentication.
 * @param {string[]} scopes List of resource access scopes.
 * @returns {AuthClientTwoLegged} 2-legged authentication client.
 */
async function getClient(scopes) {
    scopes = scopes || config.scopes.internal;
    const key = scopes.join('+');
    if ( cache[key] )
        return (cache[key]);

    try {
        const { client_id, client_secret } = config.credentials;
        let client = new AuthClientTwoLegged(client_id, client_secret, scopes || config.scopes.internal, true);
        let credentials = await client.authenticate();
        cache[key] = client;
        console.log (`OAuth2 client created for ${key}`);
        return (client);
    } catch ( ex ) {
        return (null);
    }
}

/**
 * Creates a 3-legged OAuth client for user authentication
 * @param {string[]} scopes List of resource access scopes.
 * @param {string} callbackUrl Optional custom callback URL
 * @returns {AuthClientThreeLegged} 3-legged authentication client.
 */
function getThreeLeggedClient(scopes, callbackUrl) {
    const { client_id, client_secret, callback_url } = config.credentials;
    scopes = scopes || ['data:read', 'data:write', 'data:create', 'account:read'];
    const finalCallbackUrl = callbackUrl || callback_url;
    return new AuthClientThreeLegged(client_id, client_secret, finalCallbackUrl, scopes, true);
}

/**
 * Gets the authorization URL for 3-legged OAuth
 * @param {string} callbackUrl Optional custom callback URL
 */
function getAuthorizationUrl(callbackUrl) {
    const client = getThreeLeggedClient(null, callbackUrl);
    return client.generateAuthUrl();
}

/**
 * Exchanges authorization code for tokens
 * @param {string} code Authorization code
 * @param {string} callbackUrl Must match the URL used during authorization
 */
async function exchangeCodeForToken(code, callbackUrl) {
    const client = getThreeLeggedClient(null, callbackUrl);
    const credentials = await client.getToken(code);
    return {
        client,
        credentials
    };
}

/**
 * Stores user tokens in memory (for demo - use database in production)
 */
function setUserToken(sessionId, credentials) {
    userTokens[sessionId] = {
        credentials,
        timestamp: Date.now()
    };
}

/**
 * Gets user tokens
 */
function getUserToken(sessionId) {
    return userTokens[sessionId]?.credentials || null;
}

/**
 * Checks if user is authenticated
 */
function isUserAuthenticated(sessionId) {
    const token = userTokens[sessionId];
    if (!token) return false;
    // Check if token is expired (rough check - tokens last ~1 hour)
    if (Date.now() - token.timestamp > 55 * 60 * 1000) {
        delete userTokens[sessionId];
        return false;
    }
    return true;
}

/**
 * Refreshes user token
 */
async function refreshUserToken(sessionId) {
    const token = userTokens[sessionId];
    if (!token) return null;
    
    try {
        const client = getThreeLeggedClient();
        client.setCredentials(token.credentials);
        const newCredentials = await client.refreshToken(token.credentials);
        setUserToken(sessionId, newCredentials);
        return newCredentials;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        delete userTokens[sessionId];
        return null;
    }
}

module.exports = {
    getClient,
    getThreeLeggedClient,
    getAuthorizationUrl,
    exchangeCodeForToken,
    setUserToken,
    getUserToken,
    isUserAuthenticated,
    refreshUserToken
};
