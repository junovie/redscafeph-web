import { Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Menu from "@/pages/Menu";
import Rewards from "@/pages/Rewards";
import About from "@/pages/About";
import Reviews from "@/pages/Reviews";
import NotFound from "@/pages/NotFound";
import Order from "@/pages/Order";
import OrderStatus from "@/pages/OrderStatus";
import { IS_STORE_HOST } from "@/data/site";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={IS_STORE_HOST ? <Order /> : <Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="order" element={<Order />} />
        <Route path="order/:token" element={<OrderStatus />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="this-is-us" element={<About />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
