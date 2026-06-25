import Sidebar from "./Sidebar";

export default function BrokerLayout({ children }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#030305",
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: 200,
        padding: "32px 40px",
        overflowY: "auto",
        minHeight: "100vh",
      }}>
        {children}
      </main>
    </div>
  );
}
