export const onlineReplyFormat = [
  'Your reply must be a string containing a JSON array.',
  'Every element in the array must be a JSON object with a "type" field.',
]

export const replyExamples = {
  text: '{"type": "text", "content": "Hi there!"}',
  quote: '{"type": "quote_reply", "target_timestamp": 1700000000000, "reply_content": "Your reply"}',
  voice: '{"type": "voice_message", "content": "What you want to say out loud"}',
  transfer: '{"type":"transfer","amount":12.50,"note":"reason"}',
  shopping: '{"type":"store_purchase","productId":"catalog-id","quantity":1,"recipient":"self","reason":"reason"}',
  shoppingNew: '{"type":"store_purchase","product":{"name":"Peach iced tea","price":8.50,"kind":"food","description":"Peach black tea served over ice","seller":"Corner Tea"},"quantity":1,"recipient":"user","reason":"Afternoon drink"}',
}
