const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  allowedDevOrigins: ["10.128.97.57"],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "10.128.97.57"] },
  },
};

export default nextConfig;
