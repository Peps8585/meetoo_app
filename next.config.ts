import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Le pagine gia' aperte (o preparate in anticipo) restano pronte 30 secondi:
    // tornando indietro o riaprendo una lezione non si aspetta di nuovo il server.
    // Dopo una modifica (aggiungi, togli, presenze) revalidatePath le rinfresca subito.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
