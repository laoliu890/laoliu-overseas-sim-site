export default function middleware(request) {
  const url = new URL(request.url);

  if (url.hostname === "www.globalsimhelp.com") {
    url.hostname = "globalsimhelp.com";
    return Response.redirect(url, 308);
  }
}

export const config = {
  matcher: "/:path*",
};
