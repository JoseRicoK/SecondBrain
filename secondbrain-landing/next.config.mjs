/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.SECOND_BRAIN_TEST_BUILD === '1' ? '.next-test' : '.next',
  /* config options here */
};

export default nextConfig;
