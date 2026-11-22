import { Dialog, FilePicker, FormField } from '../../components/phone'

export function ProductCategoryManagerModal() {
  return (
    <Dialog id="product-category-manager-modal">
      <div className="modal-content" style={{ height: "60%" }}>
        <div className="modal-header">
          {" "}
          <span>Manage Product Categories</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>New Category</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {" "}
              <input type="text" id="new-product-category-name-input" placeholder={"Enter a category name…"} style={{ flexGrow: "1" }} />
              {" "}
              <button id="add-new-product-category-btn" className="form-button" style={{ width: "auto", marginTop: "0", padding: "0 15px" }} type="button">Add</button>
              {" "}
            </div>
          </div>
          <hr style={{ opacity: "0.2" }} />
          <div id="existing-product-categories-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{" "}</div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="save" id="close-product-category-manager-btn" style={{ width: "100%" }} type="button">Done</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function ProductEditorModal() {
  return (
    <Dialog id="product-editor-modal">
      <div className="modal-content" style={{ height: "85%" }}>
        <div className="modal-header">
          {" "}
          <span id="product-editor-title">Add Product</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group">
            {" "}
            <label>Product Image</label>
            <div className="avatar-upload">
              {" "}
              <img id="product-image-preview" src="https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1756206115802_qdqqd_0c99bh.jpeg" alt={""} />
              {" "}
              <button onClick={() => document.getElementById("product-image-input")?.click()} type="button">Upload Image</button>
              {" "}
              <FilePicker id="product-image-input" accept="image/*" />
              {" "}
            </div>
          </div>
          <FormField id="product-name-input" label="Product Name">
            <input type="text" id="product-name-input" />
          </FormField>
          <div className="form-group">
            {" "}
            <label htmlFor="product-category-select">Product Category</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {" "}
              <select id="product-category-select" style={{ flexGrow: "1" }} />
              {" "}
              <button id="manage-product-categories-btn" className="form-button-secondary" style={{ marginTop: "0", padding: "12px" }} type="button">Manage</button>
              {" "}
            </div>
          </div>
          <div className="form-group">
            {" "}
            <label htmlFor="product-price-input">{"Default Price (¥)"}</label>
            {" "}
            <input type="number" id="product-price-input" min="0" step="0.01" />
            {" "}
          </div>
          <FormField id="product-description-input" label="Product Description">
            <textarea id="product-description-input" rows={3} placeholder={"Describe this product…"} />
          </FormField>
          <hr style={{ opacity: "0.2", margin: "20px 0" }} />
          <div className="form-group">
            {" "}
            <label>Variants</label>
            <p style={{ fontSize: "12px", color: "#888", marginTop: "-5px", marginBottom: "10px" }}>The default price applies if there are no variants.</p>
            <div id="product-variations-container" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>{" "}</div>
            {" "}
            <button id="add-product-variation-btn" className="form-button form-button-secondary" style={{ marginTop: "15px" }} type="button">+ Add Variant</button>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-product-editor-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-product-btn" type="button">Save</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function ShoppingSettingsModal() {
  return (
    <Dialog id="shopping-settings-modal">
      <div className="modal-content">
        <div className="modal-header">
          {" "}
          <span>Shopping Generation Settings</span>
          {" "}
        </div>
        <div className="modal-body">
          <div className="form-group douban-settings-item">
            {" "}
            <label htmlFor="shopping-category-count-input">
              {" Number of Categories "}
              <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Set how many product categories to generate at once. "}</p>
              {" "}
            </label>
            <div className="douban-settings-controls">
              {" "}
              <input type="number" id="shopping-category-count-input" min="1" max="10" defaultValue="3" />
              {" "}
              <span>items</span>
              {" "}
            </div>
          </div>
          <div className="form-group douban-settings-item">
            {" "}
            <label htmlFor="shopping-product-count-input">
              {" Products per Category "}
              <p style={{ fontSize: "12px", fontWeight: "normal", color: "#999", marginTop: "5px" }}>{" Set how many products to generate in each category. "}</p>
              {" "}
            </label>
            <div className="douban-settings-controls">
              {" "}
              <input type="number" id="shopping-product-count-input" min="2" max="10" defaultValue="8" />
              {" "}
              <span>items</span>
              {" "}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-shopping-settings-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="save-shopping-settings-btn" type="button">Save</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}

export function VariationSelectionModal() {
  return (
    <Dialog id="variation-selection-modal">
      <div className="modal-content" style={{ width: "320px", height: "auto" }}>
        <div className="modal-header" style={{ paddingBottom: "0" }}>{" "}</div>
        <div className="modal-body">
          <div id="variation-product-info" style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "15px" }}>
            {" "}
            <img id="variation-product-image" style={{ width: "80px", height: "80px", borderRadius: "6px", objectFit: "cover" }} alt={""} />
            <div>
              <p id="variation-product-name" style={{ fontWeight: "500", margin: "0" }} />
              <p id="variation-selected-price" style={{ color: "#ff5722", fontWeight: "bold", fontSize: "18px", margin: "8px 0 0" }} />
            </div>
          </div>
          <div className="form-group">
            {" "}
            <label>Select Variant</label>
            <div id="variation-options-container" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>{" "}</div>
          </div>
          <div className="form-group">
            {" "}
            <label>Quantity</label>
            <div className="quantity-control" style={{ justifyContent: "flex-start" }}>
              {" "}
              <button className="quantity-btn" id="variation-decrease-qty" type="button">-</button>
              {" "}
              <span className="quantity-display" id="variation-quantity-display">1</span>
              {" "}
              <button className="quantity-btn" id="variation-increase-qty" type="button" aria-label="Add">+</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {" "}
          <button className="cancel" id="cancel-variation-selection-btn" type="button">Cancel</button>
          {" "}
          <button className="save" id="confirm-variation-selection-btn" type="button">Add to Cart</button>
          {" "}
        </div>
      </div>
    </Dialog>
  )
}
