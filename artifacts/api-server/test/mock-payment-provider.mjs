const nativeFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://api.paystack.co/transaction/verify/")) {
    const reference = decodeURIComponent(url.split("/").at(-1));
    const failed = reference.includes("payment-failure");
    return Response.json({
      status: true,
      data: {
        status: failed ? "failed" : "success",
        amount: 100000,
        reference,
      },
    });
  }
  return nativeFetch(input, init);
};