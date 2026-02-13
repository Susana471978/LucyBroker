import { Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
};

export default AppLayout;
