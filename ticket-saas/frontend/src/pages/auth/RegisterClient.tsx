import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { registerClientApi } from "../../services/api";

interface FormData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  businessRegNo?: string;
  gstNumber?: string;
}

const Field = ({ label, error, children }: any) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 8 }}>{label}</label>
    {children}
    {error && <p style={{ color: "#FF5555", fontSize: 12, marginTop: 4 }}>{error}</p>}
  </div>
);

const inputStyle = { width: "100%", background: "#0F0F13", border: "1px solid #2A2A38", borderRadius: 10, color: "#E8E8F0", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" as const, fontFamily: "DM Sans, sans-serif" };

const RegisterClient = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError("");
      await registerClientApi(data);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ width: 420, background: "#16161E", border: "1px solid #00D4A133", borderRadius: 20, padding: 40, textAlign: "center", fontFamily: "DM Sans, sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ color: "#00D4A1", fontWeight: 700, fontSize: 22 }}>Registration Successful!</h2>
        <p style={{ color: "#555", marginTop: 8, fontSize: 14 }}>Your account is pending approval. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div style={{ width: 520, background: "#16161E", border: "1px solid #23232F", borderRadius: 20, padding: 40, fontFamily: "DM Sans, sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 8 }}>Ticket SaaS</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E8E8F0", letterSpacing: "-0.02em" }}>Create your account</h1>
        <p style={{ color: "#555", fontSize: 14, marginTop: 6 }}>Register as a comedian / client</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>

        {/* Section: Account */}
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Account Details</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Email" error={errors.email?.message}>
            <input {...register("email", { required: "Required" })} placeholder="you@example.com" style={inputStyle} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input {...register("password", { required: "Required", minLength: { value: 6, message: "Min 6 characters" } })} type="password" placeholder="••••••••" style={inputStyle} />
          </Field>
        </div>

        {/* Section: Profile */}
        <div style={{ fontSize: 11, color: "#6C63FF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, marginTop: 8 }}>Profile Details</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Full Name" error={errors.fullName?.message}>
            <input {...register("fullName", { required: "Required" })} placeholder="John Doe" style={inputStyle} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <input {...register("phone", { required: "Required" })} placeholder="9876543210" style={inputStyle} />
          </Field>
          <Field label="Company Name" error={errors.companyName?.message}>
            <input {...register("companyName", { required: "Required" })} placeholder="Comedy Nights" style={inputStyle} />
          </Field>
          <Field label="Business Reg No (optional)">
            <input {...register("businessRegNo")} placeholder="REG123456" style={inputStyle} />
          </Field>
          <Field label="GST Number (optional)">
            <input {...register("gstNumber")} placeholder="GST987654" style={inputStyle} />
          </Field>
          <Field label="Address" error={errors.address?.message}>
            <input {...register("address", { required: "Required" })} placeholder="123 Street" style={inputStyle} />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <input {...register("city", { required: "Required" })} placeholder="Mumbai" style={inputStyle} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <input {...register("state", { required: "Required" })} placeholder="Maharashtra" style={inputStyle} />
          </Field>
          <Field label="Country" error={errors.country?.message}>
            <input {...register("country", { required: "Required" })} placeholder="India" style={inputStyle} />
          </Field>
        </div>

        {error && (
          <div style={{ background: "#FF555511", border: "1px solid #FF555533", borderRadius: 8, padding: "10px 14px", color: "#FF5555", fontSize: 13, marginBottom: 16, marginTop: 8 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "13px", borderRadius: 10, background: loading ? "#3A3A50" : "#6C63FF", border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", fontFamily: "DM Sans", marginTop: 8 }}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#555" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#6C63FF", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
      </p>
    </div>
  );
};

export default RegisterClient;