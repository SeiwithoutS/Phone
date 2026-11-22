import { BackButton, Screen, ScreenHeader } from '../../components/phone'

export function CartScreen() {
  return (
    <Screen id="cart-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="cart-back-btn" />
        {" "}
        <span id="cart-title">Cart (0)</span>
        {" "}
        <span className="action-btn" id="clear-cart-btn">Clear</span>
        {" "}
      </ScreenHeader>
      <div id="cart-items-list" className="list-container">{" "}</div>
      <div id="cart-footer">
        {" "}
        <label className="select-all-label">
          <input type="checkbox" id="select-all-cart-items" />
          {" Select All"}
        </label>
        <div className="cart-summary">
          <div id="cart-total">{"Total ¥0.00"}</div>
          {" "}
          <span className="cart-subtext">Shipping excluded</span>
        </div>
        {" "}
        <button id="checkout-btn" type="button">Checkout (0)</button>
      </div>
    </Screen>
  )
}

export function ProductDetailScreen() {
  return (
    <Screen id="product-detail-screen">
      <ScreenHeader>
        {" "}
        <BackButton id="product-detail-back-btn" />
        {" "}
        <span>Product Details</span>
        {" "}
        <span style={{ width: "30px" }} />
        {" "}
      </ScreenHeader>
      <div id="product-detail-content" className="list-container">{" "}</div>
      <div id="product-detail-footer">
        {" "}
        <button className="footer-btn add-to-cart-detail-btn" type="button">Add to Cart</button>
        {" "}
        <button className="footer-btn buy-now-btn" type="button">Buy Now</button>
        {" "}
      </div>
    </Screen>
  )
}

export function ShoppingScreen() {
  return (
    <Screen id="shopping-screen">
      <ScreenHeader>
        <div className="header-left-actions">
          {" "}
          <BackButton id="shopping-back-btn" />
          {" "}
          <span className="action-btn" id="generate-shopping-items-btn" title="Generate Products">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="shopping-settings-btn" title="Generation Settings">
            {" "}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.12,4.84c-0.59,0.24-1.12,0.56-1.62,0.94L5.11,4.82c-0.22-0.08-0.47,0-0.59,0.22l-1.92,3.32 c-0.12,0.22-0.07,0.47,0.12,0.61l2.03,1.58C4.84,11.36,4.82,11.68,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.48,2.03 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.48-2.03c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="delete-current-category-btn" title="Delete Current Category" style={{ display: "none", color: "rgb(255, 59, 48)" }}>
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
            {" "}
          </span>
          {" "}
        </div>
        {" "}
        <span>Shopping Center</span>
        <div className="header-actions">
          {" "}
          <span className="action-btn" id="manage-products-btn" title="Manage Products" style={{ color: "var(--text-primary)" }}>
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="add-new-product-btn" title="Add Product">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            {" "}
          </span>
          {" "}
          <span className="action-btn" id="go-to-cart-btn" title="View Cart">
            {" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {" "}
            <span id="cart-count">0</span>
            {" "}
          </span>
          {" "}
        </div>
      </ScreenHeader>
      <div id="product-category-tabs" />
      <div id="product-grid" className="list-container">{" "}</div>
      <div id="shopping-action-bar">
        {" "}
        <label className="select-all-label">
          {" "}
          <input type="checkbox" id="select-all-products-checkbox" />
          {" Select All "}
        </label>
        {" "}
        <button id="delete-selected-products-btn" className="action-bar-btn" type="button">Delete (0)</button>
        {" "}
      </div>
    </Screen>
  )
}
