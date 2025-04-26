// --- Configuration ---
var applicationId = properties.applicationId
var baseUri = properties.baseUri || 'https://api.moesif.net'
var debug = properties.debug || false;
var logBody = properties.logBody || true;
var eventsEndpoint = '/v1/events'
var maxRetries = properties.maxRetries || 2;

var version = '0.0.1'


// -- Configuration for getUser
function getUser() {
  log("Entering getUser function");
  var headerValue = getHeader(request.headers, 'Authorization'); 
  log("Authorization header value: " + headerValue);

  if (!headerValue) {
    log("Authorization header is missing");
    return null;
  }

  const token = headerValue.replace('Bearer ', '');
  log("Extracted token: " + token);

  try {
    const payloadBase64 = token.split('.')[1];
    log("Extracted payload base64: " + payloadBase64);

    if (!payloadBase64) {
      log("Invalid JWT format: Missing payload");
      return null; // Invalid JWT format
    }

    const payloadJson = fromBase64(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')).replace(/\0/g, ''); // Replace URL-safe characters
    log("Decoded payload JSON: " + payloadJson);

    const payload = JSON.parse(payloadJson);
    log("Parsed payload: " + JSON.stringify(payload));

    const userId = payload.sub || null;
    log("Extracted user ID: " + userId);

    return userId;
  } catch (error) {
    log("Error decoding or parsing JWT: " + error);
    return null; // Invalid JWT
  }
}

// -- Configuration for getCompany
function getCompany() {
  return undefined
}

// Configuration for getMetadata
function getMetadata() {
  var proxyName = context.getVariable('proxy.name');
  var envName = context.getVariable('environment.name');
  return {
    apigee_proxy: proxyName,
    apigee_env: envName,
  }
}

// --- Helper Function: log ---
function log(message) {
  if (debug) return print("[moesif-api-analytics] " + message);
}

// --- Helper Function: Safely Get Header ---
function getHeader(headersObject, headerName) {
  if (!(headerName in headersObject)) {
        return undefined;
  }
  var headerValue = headersObject[headerName];
  if (Array.isArray(headerValue)) {
    if (headerValue.length > 0) {
      return headerValue.join(','); 
    } else {
      return undefined;
    }
  }
  return headerValue; // Return the value or undefined
}

// --- Helper Function: Generate UUID ---
function generateUUID() {
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
      v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return uuid;
}

// --- Function to get all headers ---
function getAllHeaders(headersObject) {
  var headers = {};
    for (var headerName in headersObject) {
      headers[headerName] = getHeader(headersObject, headerName);
    }
  log("Total headers processed: " + Object.keys(headers).length);
  return headers;
}

// --- Function to get request headers ---
function getAllRequestHeaders() {
  log("Entering getAllRequestHeaders function"); 
  var requestHeaders = getAllHeaders(request.headers);
  log("Completed getAllRequestHeaders function, headers count: " + Object.keys(requestHeaders).length);
  return requestHeaders;
}

// --- Function to get response headers ---
function getAllResponseHeaders() {
  log("Entering getAllResponseHeaders function"); 
  var responseHeaders = getAllHeaders(response.headers);
  log("Completed getAllResponseHeaders function, headers count: " + Object.keys(responseHeaders).length);
  return responseHeaders;
}


// -- Function to get body and transfer encoding
function parseBody(content, headers) {
  log("Entering parseBody function");
  var contentType = getHeader(headers, 'Content-Type');
  var isJSON = false;
  if (contentType != undefined) {
    isJSON = contentType.indexOf('json') > -1;
  }
  log("Content-Type is: " + contentType); 
  log("Content length: " + (content ? content.length : 0));
  
  if (logBody && isJSON && content) {
    try {
      var body = JSON.parse(content);
      return {
        body: body,
        transferEncoding: undefined
      }
    } catch (e) {
      log("Error parsing request body as JSON: " + e);
      return {
        body: toBase64(content), 
        transferEncoding: 'base64'
      }
    }
  } else if (content) {
      log("Cannot parse as JSON");
      return {
        body: toBase64(content), 
        transferEncoding: 'base64'
      }
  } else {
    body: undefined
  }
}

// --- Extract Event Data for Moesif ---
function extractMoesifEvent() {
  log("Entering extractMoesifEvent function"); 
  var now = new Date().toISOString();
  log("Current time: " + now);
  
  var requestStartTimeMillis = context.getVariable('client.received.start.timestamp');
  
  var requestArrivalTime = requestStartTimeMillis ? new Date(parseInt(requestStartTimeMillis)).toISOString() : now;
  log("Request arrival time: " + requestArrivalTime);

  // Handle content encoding safely
  log("Parsing request body");
  var requestBody = parseBody(request.content, request.headers);
  log("Request body parsed, has body: " + (requestBody.body !== undefined));
  
  log("Parsing response body");
  var responseBody = parseBody(response.content, response.headers);
  log("Response body parsed, has body: " + (responseBody.body !== undefined));

  var responseStatus = response.status ? response.status.code : 0;
  var transactionId = context.getVariable('request.header.X-Transaction-ID') || context.getVariable('transaction.id') || generateUUID();

  var moesifEvent = {
    request: {
      uri: request.uri,
      verb: request.method,
      headers: getAllRequestHeaders(),
      body: requestBody.body,
      transfer_encoding: requestBody.transferEncoding,
      time: requestArrivalTime,
    },
    response: {
      status: parseInt(responseStatus),
      headers: getAllResponseHeaders(),
      body: responseBody.body,
      transfer_encoding: responseBody.transferEncoding,
      time: now,
    },
    user_id: getUser(),
    company_id: getCompany(),
    timestamp: now,
    metadata: getMetadata(),
    transaction_id: transactionId
  };
  
  return moesifEvent;
}

// --- Function to send data to Moesif with retry logic using callbacks ---
function sendDataWithRetry(payload, attemptNum, callback) {
  log("Entering sendDataWithRetry function"); 

  // Set default values if not provided
  attemptNum = attemptNum || 0;
  callback = callback || function() {};
  
  log("Attempt number: " + (attemptNum + 1) + " of " + maxRetries);
  log("Payload size: " + payload.length);
  log("Payload: " + payload);

  var moesifHeaders = {
      'Content-Type': 'application/json',
      'X-Moesif-Application-Id': applicationId,
      'Content-Length': payload.length,
      'User-Agent': 'moesif-apigee/' + version
  }

  var moesifReq = new Request(baseUri + eventsEndpoint, 'POST', moesifHeaders, payload);

  httpClient.send(moesifReq, function(res, error) {
    var responseBody = '';
    log("Response headers: " + JSON.stringify(res.headers));
    log("Response completed for attempt " + (attemptNum + 1) + ", status: " + res.statusCode);

    // Check result
    if (res.status < 300) {
      log("Moesif request successful with status code: " + res.status); 
      log("Exiting sendDataWithRetry after successful attempt " + (attemptNum + 1));
      return callback(null, true); // Success
    } else {
      log("Moesif collector error response, attempt " + (attemptNum + 1) + ", status: " + res.status);
      log("Error response body: " + responseBody);

      // Check if we should retry
      if (attemptNum < maxRetries - 1 && !response.status || response.status >= 500) {
        // Wait before retrying
        log("Retrying, attempt " + (attemptNum + 2));
        sendDataWithRetry(payload, attemptNum + 1, callback);
      } else {
        // No more retries
        log("Failed all " + maxRetries + " retry attempts"); 
        log("Setting moesif.logging.failed variable to true");
        context.setVariable('moesif.logging.failed', true);
        return callback(new Error("All retry attempts failed"), false);
      }
    };
  });
}

// --- Main Logic: Prepare and Send Event to Moesif ---
log("Starting Moesif logging policy"); 
if (!applicationId) {
   print("Moesif applicationId not defined. Please ensure applicationId property is added to your policy XML.");
}

try {
  // Extract the event data
  log("Extracting Moesif event data");
  var moesifEvent = extractMoesifEvent();
  log("Event extracted successfully");
  
  var moesifPayload = JSON.stringify(moesifEvent);
  log("Event serialized to JSON, payload size: " + moesifPayload.length);

  // Call the function to send data with callback
  log("Initiating send data with retry mechanism");
  sendDataWithRetry(moesifPayload, 0, function(error, success) {
    if (error) {
      log("Error in sendDataWithRetry: " + error);
      log("Error message: " + error.message);
    } else {
      log("Moesif logging completed successfully");
      log("Success status: " + success);
    }
  });

  log("Policy execution initiated, continuing with next stage"); 
} catch (error) {
  // Catch any synchronous errors in the main flow
  log("Error in main Moesif logging flow: " + error);
  log("Error message: " + error.message);
  log("Error stack: " + error.stack);
  // Continue with the API flow even if logging fails
}

/**
 * Base64 encoding function
 * @param {string|array} data - The data to encode (string or byte array)
 * @return {string} The base64 encoded string
 */
function toBase64(str) {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var result = '';
  var i = 0;

  while (i < str.length) {
    var char1 = str.charCodeAt(i++);
    var char2 = str.charCodeAt(i++);
    var char3 = str.charCodeAt(i++);

    var enc1 = char1 >> 2;
    var enc2 = ((char1 & 3) << 4) | (char2 >> 4);
    var enc3 = ((char2 & 15) << 2) | (char3 >> 6);
    var enc4 = char3 & 63;

    if (isNaN(char2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(char3)) {
      enc4 = 64;
    }

    result += base64Chars.charAt(enc1) + base64Chars.charAt(enc2) + base64Chars.charAt(enc3) + base64Chars.charAt(enc4);
  }

  return result;
}

/**
 * Base64 decoding function
 * @param {string} str - The base64 encoded string
 * @return {string} The decoded string
 */
function fromBase64(str) {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var result = '';
  var i = 0;

  while (i < str.length) {
    var enc1 = base64Chars.indexOf(str.charAt(i++));
    var enc2 = base64Chars.indexOf(str.charAt(i++));
    var enc3 = base64Chars.indexOf(str.charAt(i++));
    var enc4 = base64Chars.indexOf(str.charAt(i++));

    var char1 = (enc1 << 2) | (enc2 >> 4);
    var char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    var char3 = ((enc3 & 3) << 6) | enc4;

    result += String.fromCharCode(char1);

    if (enc3 !== 64) {
      result += String.fromCharCode(char2);
    }
    if (enc4 !== 64) {
      result += String.fromCharCode(char3);
    }
  }

  return result;
}