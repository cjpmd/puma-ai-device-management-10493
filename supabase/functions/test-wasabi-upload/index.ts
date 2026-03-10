import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    // Step 1: Generate presigned URL directly (bypass auth for test)
    log("Step 1: Generating presigned URL for Wasabi...");

    const accessKey = Deno.env.get("WASABI_ACCESS_KEY");
    const secretKey = Deno.env.get("WASABI_SECRET_KEY");
    const bucket = Deno.env.get("WASABI_BUCKET");
    const region = (Deno.env.get("WASABI_REGION") || "us-east-1").trim();
    let endpoint = (Deno.env.get("WASABI_ENDPOINT") || `https://s3.${region}.wasabisys.com`).trim();
    if (!endpoint.startsWith("http")) endpoint = `https://${endpoint}`;

    if (!accessKey || !secretKey || !bucket) {
      log("ERROR: Missing Wasabi credentials");
      return new Response(JSON.stringify({ success: false, logs, error: "Missing Wasabi credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Wasabi config: bucket=${bucket}, region=${region}, endpoint=${endpoint}`);

    const testPath = `test/wasabi-test-${Date.now()}.txt`;
    const testContent = "Hello from Lovable Wasabi test! " + new Date().toISOString();
    const expiresIn = 900;

    // AWS Signature V4 presigned URL generation
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const shortDate = dateStamp.substring(0, 8);
    const credential = `${accessKey}/${shortDate}/${region}/s3/aws4_request`;
    const host = endpoint.replace("https://", "").replace("http://", "");

    const canonicalQueryString = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${dateStamp}`,
      `X-Amz-Expires=${expiresIn}`,
      `X-Amz-SignedHeaders=host`,
    ].sort().join("&");

    const canonicalRequest = [
      "PUT",
      `/${bucket}/${testPath}`,
      canonicalQueryString,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const hashedCanonicalRequest = await sha256(canonicalRequest);

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      dateStamp,
      `${shortDate}/${region}/s3/aws4_request`,
      hashedCanonicalRequest,
    ].join("\n");

    const signingKey = await getSignatureKey(secretKey, shortDate, region, "s3");
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    const presignedUrl = `${endpoint}/${bucket}/${testPath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    log(`Presigned URL generated for path: ${testPath}`);

    // Step 2: Upload test file via PUT
    log("Step 2: Uploading test file to Wasabi...");

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: testContent,
    });

    const uploadStatus = uploadResponse.status;
    const uploadBody = await uploadResponse.text();

    log(`Upload response: status=${uploadStatus}`);
    if (uploadBody) log(`Upload response body: ${uploadBody.substring(0, 500)}`);

    if (uploadStatus >= 200 && uploadStatus < 300) {
      log("✅ SUCCESS: File uploaded to Wasabi!");

      // Step 3: Verify by doing a GET (generate a GET presigned URL)
      log("Step 3: Verifying file exists...");

      const getCanonicalQueryString = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${dateStamp}`,
        `X-Amz-Expires=${expiresIn}`,
        `X-Amz-SignedHeaders=host`,
      ].sort().join("&");

      const getCanonicalRequest = [
        "GET",
        `/${bucket}/${testPath}`,
        getCanonicalQueryString,
        `host:${host}\n`,
        "host",
        "UNSIGNED-PAYLOAD",
      ].join("\n");

      const getStringToSign = [
        "AWS4-HMAC-SHA256",
        dateStamp,
        `${shortDate}/${region}/s3/aws4_request`,
        await sha256(getCanonicalRequest),
      ].join("\n");

      const getSignature = toHex(await hmacSha256(signingKey, getStringToSign));
      const getUrl = `${endpoint}/${bucket}/${testPath}?${getCanonicalQueryString}&X-Amz-Signature=${getSignature}`;

      const getResponse = await fetch(getUrl);
      const getBody = await getResponse.text();
      log(`GET response: status=${getResponse.status}, body="${getBody}"`);

      if (getBody === testContent) {
        log("✅ VERIFIED: File content matches!");
      } else {
        log("⚠️ Content mismatch or could not verify");
      }

      return new Response(JSON.stringify({
        success: true,
        logs,
        test_path: testPath,
        upload_status: uploadStatus,
        verified: getBody === testContent,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      log(`❌ FAILED: Upload returned status ${uploadStatus}`);
      return new Response(JSON.stringify({
        success: false,
        logs,
        upload_status: uploadStatus,
        error: uploadBody,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    return new Response(JSON.stringify({ success: false, logs, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Crypto helpers
function hmacSha256(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

function sha256(data: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
    .then((h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  let kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  let kRegion = await hmacSha256(new Uint8Array(kDate), region);
  let kService = await hmacSha256(new Uint8Array(kRegion), service);
  let kSigning = await hmacSha256(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
