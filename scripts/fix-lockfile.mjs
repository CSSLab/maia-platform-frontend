import { execSync } from "child_process";
import { unlinkSync, existsSync } from "fs";

const lockfilePath = "package-lock.json";

if (existsSync(lockfilePath)) {
  console.log("Removing existing package-lock.json...");
  unlinkSync(lockfilePath);
} else {
  console.log("No existing package-lock.json found.");
}

console.log("Running npm install --legacy-peer-deps to regenerate lock file...");
try {
  execSync("npm install --legacy-peer-deps", { stdio: "inherit" });
  console.log("Lock file regenerated successfully.");
} catch (error) {
  console.error("npm install failed:", error.message);
  process.exit(1);
}
