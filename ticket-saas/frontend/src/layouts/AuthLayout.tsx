import { Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        background: "#FFFFFF", // better soft-gray than pure white
        padding: "40px 20px",
      }}
    >
      
        <Outlet />
      </div>
  );
};

export default AuthLayout;