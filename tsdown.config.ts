import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    tsgo: true,
  },
  entry: ["./src/index.ts"],
  exports: true,
  deps: {
   skipNodeModulesBundle: true, 
  }
 
  // ...config options
})
