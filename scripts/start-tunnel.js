const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const viteConfigPath = path.resolve(__dirname, "../apps/web/vite.config.ts");

console.log("Starting localhost.run SSH tunnel for Vite dev server on port 5173...");

// Spawn SSH tunnel
// nokey@localhost.run doesn't require a password or SSH key setup.
// StrictHostKeyChecking=no prevents ssh from prompting to accept host fingerprint.
const ssh = spawn("ssh", [
  "-o", "StrictHostKeyChecking=no",
  "-R", "80:localhost:5173",
  "nokey@localhost.run"
]);

let urlDetected = false;

function handleOutput(data) {
  const output = data.toString();
  
  // Print tunnel stdout/stderr to help monitor connection status
  if (output.trim()) {
    console.log(`[tunnel] ${output.trim()}`);
  }

  if (urlDetected) return;

  // Search for the public URL in stdout/stderr, excluding the admin.localhost.run link
  const match = output.match(/https?:\/\/((?!admin\b)[a-zA-Z0-9.-]+)\.(lhr\.life|localhost\.run|lhr\.host)/i);
  if (match) {
    const url = match[0];
    const hostname = url.replace(/^https?:\/\//i, "");
    
    console.log(`\n🎉 Tunnel successfully established!`);
    console.log(`🔗 Public URL: ${url}`);
    console.log(`🏠 Hostname: ${hostname}\n`);

    urlDetected = true;

    // Update allowedHosts in apps/web/vite.config.ts
    try {
      if (fs.existsSync(viteConfigPath)) {
        let config = fs.readFileSync(viteConfigPath, "utf8");
        // Matches allowedHosts: ["xxx"]
        const updatedConfig = config.replace(
          /allowedHosts:\s*\["[a-zA-Z0-9.-]+"\]/,
          `allowedHosts: ["${hostname}"]`
        );
        fs.writeFileSync(viteConfigPath, updatedConfig, "utf8");
        console.log(`[tunnel] Updated allowedHosts in vite.config.ts to: ${hostname}`);
      }
    } catch (err) {
      console.error("[tunnel] Failed to update vite.config.ts:", err.message);
    }

    // Generate and display QR code in terminal using api workspace's qrcode package
    try {
      const qrcodePath = path.resolve(__dirname, "../apps/api/node_modules/qrcode");
      const QRCode = require(qrcodePath);
      QRCode.toString(url, { type: "terminal", small: true }, (err, qrText) => {
        if (err) {
          console.error("[tunnel] Failed to generate QR code:", err);
        } else {
          console.log("\nScan this QR code to access EasyPOS on your mobile device:");
          console.log(qrText);
        }
      });
    } catch (err) {
      console.log("[tunnel] qrcode package not loaded; skipping QR code print.");
    }
  }
}

ssh.stdout.on("data", handleOutput);
ssh.stderr.on("data", handleOutput);

ssh.on("close", (code) => {
  console.log(`[tunnel] SSH process closed with code ${code}`);
});
