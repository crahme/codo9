"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function DeviceOverviewChart({ data }) {
  return (
    <div className="bg-slate-800 p-4 rounded-2xl text-white">
      <h2 className="mb-2 text-lg font-semibold">Device Overview</h2>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#aaa" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="consumption" fill="#38bdf8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
