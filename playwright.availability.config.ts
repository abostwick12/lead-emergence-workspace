import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e",testMatch:"executive-availability-component.spec.ts",workers:1,retries:0,timeout:45000,
 reporter:[["list"]],outputDir:"test-results/availability-component",
 use:{baseURL:"http://127.0.0.1:3130",channel:"chrome",trace:"retain-on-failure",screenshot:"only-on-failure"},
 projects:[{name:"desktop",use:{...devices["Desktop Chrome"]}},{name:"mobile",use:{...devices["Pixel 7"]}}]
 // The bounded runner owns and closes Vite cooperatively, avoiding Windows process-tree cleanup.
});
