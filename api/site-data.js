const { getSiteData } = require("./_supabase");

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const data = await getSiteData();
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 500, {
      error: "site_data_failed",
      message: error.message,
    });
  }
};
