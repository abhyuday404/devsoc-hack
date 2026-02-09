"use client";

export default function GraphsView() {
  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {[1, 2].map((box) => (
          <div
            key={box}
            className="border-2 border-[#933333] bg-[#933333]/5 flex items-center justify-center min-h-[180px]"
          >
            <p className="font-bold text-[#933333]/70">Graph Box {box}</p>
          </div>
        ))}

        {[3, 4].map((box) => (
          <div
            key={box}
            className="border-2 border-[#933333] bg-[#933333]/5
                       flex flex-col min-h-45 p-4"
          >
            {/* Center content */}
            <div className="flex-1 flex items-center justify-center">
              <p className="font-bold text-[#933333]/70">Graph Box {box}</p>
            </div>

            <div className="w-full flex gap-4">
              <input
                type="text"
                placeholder={`Show me a summary of all columns...`}
                className="px-3 py-2 w-full border-2 border-[#933333]
                           text-sm text-[#933333]
                           focus:outline-none focus:ring-2
                           focus:ring-[#933333]/40 "
              />
              <button className="bg-[#933333] text-[#FFE2C7] px-5 font-bold hover:cursor-pointer">
                Submit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
