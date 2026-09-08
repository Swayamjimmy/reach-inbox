import { loginWithGoogle } from "../api";

export default function Login() {
  const error = new URLSearchParams(location.search).get("error");

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="w-[466px] min-h-[463px] border border-[#e0e4e2] rounded-[10px] px-[53px] py-[48px] pb-[38px] shadow-sm">
        <h1 className="m-0 mb-[29px] text-center text-4xl leading-none tracking-[-0.8px]">
          Login
        </h1>

        <button 
          className="w-full h-[46px] rounded-[10px] bg-[#e1f5ea] flex items-center justify-center gap-3 text-base text-[#26302a]" 
          onClick={loginWithGoogle}
        >
          <span className="w-[18px] h-[18px] rounded-full grid place-items-center text-base font-bold text-[#4285f4] bg-white">
            G
          </span>
          Login with Google
        </button>

        <div className="flex items-center gap-[15px] my-[21px] text-[#b4b8b6] text-sm whitespace-nowrap">
          <span className="h-px bg-[#e2e6e4] flex-1" />
          or sign up through email
          <span className="h-px bg-[#e2e6e4] flex-1" />
        </div>

        <input 
          className="w-full h-[52px] border-0 bg-[#f4f6f5] rounded-[9px] mb-3 px-[18px] text-[#4e5651] outline-none" 
          placeholder="Email ID" 
          disabled 
        />

        <input
          className="w-full h-[52px] border-0 bg-[#f4f6f5] rounded-[9px] mb-3 px-[18px] text-[#4e5651] outline-none"
          placeholder="Password"
          type="password"
          disabled
        />

        <button className="w-full h-[47px] rounded-[10px] mt-3.5 bg-[#00ac43] text-white font-medium disabled:cursor-default" disabled>
          Login
        </button>

        {error && <div className="mt-[15px] text-xs text-[#c5392d] text-center">{error}</div>}
      </div>
    </div>
  );
}