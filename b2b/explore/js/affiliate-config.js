/** Public, non-secret affiliate link configuration.
 * Leave empty until Booking.com APAC approves the publisher and supplies
 * an authorized CJ tracking link. Never invent tracking IDs or commissions.
 * When approved, add a reviewed object:
 * {partner:"booking_apac",category:"stay",title:"Booking.com 住宿查詢",
 *  url:"<actual CJ-issued HTTPS tracking URL>",approved:true}
 * The renderer applies a conservative destination host allowlist.
 */
window.TIANDAO_AFFILIATE_LINKS=[];
