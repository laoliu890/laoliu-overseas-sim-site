const defaultProducts = [
  {
    id: "self",
    name: "giffgaff 自助卡",
    badge: "自行激活充值，附中文教程",
    description: "适合愿意跟着教程自己完成激活和充值的用户。",
    price_usd: 10,
    price_cny: 68,
    features: ["英国 giffgaff 实体 SIM 卡", "附中文激活与充值教程", "国内仓库发货，物流可查"],
    sort_order: 1,
    active: true,
  },
  {
    id: "assist",
    name: "giffgaff 省心卡",
    badge: "客服一对一协助激活充值",
    description: "适合不想自己研究教程，希望有人协助完成激活充值的用户。",
    price_usd: 24,
    price_cny: 160,
    features: ["英国 giffgaff 实体 SIM 卡", "客服一对一协助激活充值", "售后优先响应"],
    sort_order: 2,
    active: true,
  },
];

const defaultFaqs = [
  {
    question: "这张卡适合哪些人？",
    answer:
      "适合赴英旅行、英国留学、商务通信、欧洲短期出行，或希望提前准备英国号码的用户。如果只是临时上网且不需要英国号码，也可以对比 eSIM 或当地流量卡。",
    sort_order: 1,
    active: true,
  },
  {
    question: "自助卡和省心卡有什么区别？",
    answer:
      "自助卡主要提供实体 SIM 卡和中文教程，用户自行完成激活充值；省心卡在实体卡基础上增加一对一协助，更适合赶时间、英文页面不熟、或担心付款和激活出错的用户。",
    sort_order: 2,
    active: true,
  },
  {
    question: "giffgaff 是否有固定月租？",
    answer:
      "giffgaff 属于预付费使用方式，可以按需购买套餐或充值余额。套餐有效期、自动续费、余额扣费和号码保留规则可能调整，建议在官方账户页面确认后再付款。",
    sort_order: 3,
    active: true,
  },
  {
    question: "如何充值和查询余额？",
    answer:
      "一般可通过 giffgaff 官网或官方 App 管理账户、购买套餐和查看余额。不同付款方式的可用性可能变化，具体以 giffgaff 官方页面显示为准。",
    sort_order: 4,
    active: true,
  },
  {
    question: "在英国以外能用吗？",
    answer:
      "可以按 giffgaff 官方漫游规则使用。欧盟及指定地区的通话、短信和流量通常有单独规则与公平使用限制；非欧盟地区费用差异较大，出行前需要先查官方漫游资费。",
    sort_order: 5,
    active: true,
  },
  {
    question: "激活后号码有效期是多久？",
    answer:
      "长期保号需要保持号码活跃，例如按官方规则定期产生余额变动、短信、通话或充值记录。号码保留规则以 giffgaff 官方说明为准，建议不要长期完全闲置。",
    sort_order: 6,
    active: true,
  },
  {
    question: "插卡后没有信号怎么办？",
    answer:
      "先确认手机无运营商锁、SIM 卡已激活、飞行模式关闭，并重启手机。海外使用时需要打开数据漫游；仍无信号时可以手动选择网络，或联系客服协助排查。",
    sort_order: 7,
    active: true,
  },
  {
    question: "这张卡能保证注册某个平台成功吗？",
    answer:
      "不能保证。不同平台会根据号码、设备、网络、资料、登录环境等多因素判断。本站提供 SIM 卡、教程和基础协助，不提供绕过平台规则、批量注册或规避风控的服务。",
    sort_order: 8,
    active: true,
  },
];

module.exports = {
  defaultFaqs,
  defaultProducts,
};
