import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("buildings", "routes/buildings.tsx"),
  route("research", "routes/research.tsx"),
  route("research/:category", "routes/research-tree.tsx"),
  route("heroes", "routes/heroes.tsx"),
  route("heroes/:slug", "routes/hero.tsx"),
  route("equipment", "routes/equipment.tsx"),
  route("exclusive", "routes/exclusive.tsx"),
  route("skyfighter", "routes/skyfighter.tsx"),
  route("alliance-tech", "routes/alliance-tech.tsx"),
  route("decorations", "routes/decorations.tsx"),
  route("vip", "routes/vip.tsx"),
  route("survivors", "routes/survivors.tsx"),
  route("auth/sign-in", "routes/auth/sign-in.tsx"),
  route("auth/sign-up", "routes/auth/sign-up.tsx"),
  route("account", "routes/account.tsx"),
  route("pair", "routes/pair.tsx"),
] satisfies RouteConfig;
