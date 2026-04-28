type PickupItem = {
  name: string;
};

export function buildPickupPdf(vendorGroups: Record<string, PickupItem[]>) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: system-ui, Arial, sans-serif;
    padding: 20px;
    background: #f8fafc;
  }

  .title {
    font-size: 26px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .sub {
    color: #64748b;
    margin-bottom: 18px;
  }

  .vendor {
    margin-top: 25px;
  }

  .vendor-header {
    background: #0ea5e9;
    color: white;
    padding: 10px;
    font-size: 18px;
    border-radius: 10px 10px 0 0;
  }

  .box {
    background: white;
    border: 1px solid #e2e8f0;
    border-top: none;
    padding: 14px;
  }

  .item {
    display: flex;
    justify-content: space-between;
    font-size: 15px;
    padding: 6px 0;
    border-bottom: 1px dashed #e5e7eb;
  }

  .item:last-child {
    border-bottom: none;
  }

  .checkbox {
    width: 16px;
    height: 16px;
    border: 2px solid #64748b;
    margin-right: 8px;
  }

  .row {
    display: flex;
    align-items: center;
  }
</style>
</head>

<body>

  <div class="title">Restok Store Pickup List</div>
  <div class="sub">Generated ${new Date().toLocaleString()}</div>

  ${Object.entries(vendorGroups)
    .map(
      ([vendor, list]) => `
        <div class="vendor">
          <div class="vendor-header">🏪 ${vendor}</div>
          <div class="box">
            ${list
              .map(
                (item) => `
                <div class="item">
                  <div class="row">
                    <div class="checkbox"></div>
                    ${item.name}
                  </div>
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      `
    )
    .join("")}

</body>
</html>`;
}
