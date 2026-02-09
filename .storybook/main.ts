import type { StorybookConfig } from "@storybook/sveltekit";

const apiTarget = process.env.STORYBOOK_API_TARGET || "http://localhost:5173";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|ts|svelte)"],
  addons: [
    "@storybook/addon-svelte-csf",
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
  ],
  framework: "@storybook/sveltekit",
  async viteFinal(config) {
    config.server = config.server || {};
    config.server.proxy = {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    };

    // SvelteKit virtual modules aren't available in Storybook — provide stubs
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "$env/dynamic/public": new URL("./env-stub.ts", import.meta.url).pathname,
    };

    return config;
  },
};
export default config;
