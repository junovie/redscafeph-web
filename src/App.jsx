import { Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import Rewards from "@/pages/Rewards";
import About from "@/pages/About";
import Reviews from "@/pages/Reviews";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="this-is-us" element={<About />} />
        <Route path="reviews" element={<Reviews />} />
          <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
