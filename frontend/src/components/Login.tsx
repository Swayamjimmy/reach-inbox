import { loginWithGoogle } from "../api";

export default function Login() {
  const error = new URLSearchParams(location.search).get("error");

  return (
    <div className="min-h-screen grid place-items-center bg-[#f9faf9]">
      <div className="w-[420px] bg-white border border-[#e0e4e2] rounded-[12px] px-10 py-12 shadow-sm flex flex-col items-center">
        
        {/* Branded Logo */}
        <div className="font-['VT323',_monospace] text-[40px] text-[#00ab44] mb-2 tracking-[1px]">
          ReachInbox
        </div>
        
        <h1 className="m-0 mb-10 text-center text-xl font-medium text-[#4e5651]">
          Sign in to your account
        </h1>

        <button 
          className="w-full h-[52px] rounded-[10px] bg-[#e1f5ea] hover:bg-[#d4efe1] transition-colors flex items-center justify-center gap-3 text-[15px] font-semibold text-[#26302a]" 
          onClick={loginWithGoogle}
        >
          <span className="w-6 h-6 rounded-full grid place-items-center text-[15px] font-bold text-[#4285f4] bg-white shadow-sm">
            G
          </span>
          Continue with Google
        </button>

        {error && (
          <div className="mt-6 w-full p-3 bg-[#fff1f1] border border-[#fee2e2] rounded-lg text-xs text-[#c5392d] text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}