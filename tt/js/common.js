const LIMIT = 50
const PASSWD = "Valantis"

let password = generatePassword()
// commonly used elements
let urlP// for storing current URLSearchParams
let productIds = []
let productsContainer, productTemplate, filtersForm, activeFilter, pagination, pageNumber

function generatePassword() {
    const d = new Date()
    const timestamp = d.getFullYear() + `${d.getMonth()+1}`.padStart(2, "0") + `${d.getDate()}`.padStart(2, "0")
    let password = md5(`${PASSWD}_${timestamp}`)
    return password
}

async function queryApi(body)
{
    while(true){
        try {
            const data = await fetch("https://api.valantis.store:41000/",
                {
                    method: "POST",
                    body: JSON.stringify(body),
                    headers: {
                        "Content-type": "application/json",
                        "X-Auth": password
                    }
                })
            if(!data.ok)
                throw new Error(await data.text())
            const res = await data.json()
            console.log(res)//remove
            return res.result
        }
        catch (error) {
            console.log(error)
        }
    }
}

async function fetchProducts() {
    // start loading
    productsContainer.childNodes.forEach((c) => c.hidden = true)
    const loading = document.getElementById("loading")
    loading.hidden = false
    
    if(!productIds.length) {
        //getIds
        if(activeFilter.value) {
            let filterValue = urlP.get(activeFilter.value)
            //can be null, float, str
            filterValue = filterValue !== 'null' ? parseFloat(filterValue) || filterValue : null
            productIds = await queryApi({
                "action": "filter",
                "params": {[activeFilter.value]: filterValue}
            })
        } else {
            productIds = await queryApi({
                "action": "get_ids",
            })
        }
        productIds = [... new Set(productIds)]// for preventing duplicates
        console.log("unique ids: ", productIds)
        let pageCount = Math.ceil(productIds.length / LIMIT)
        console.log("total pages: ", pageCount)
        //render pagination
        let newLinks = Array.from({length: pageCount}, (uselessValue, i) => {
            p = document.createElement("a")
            p.href = p.text = i+1
            return p.outerHTML
        })
        pagination.innerHTML = newLinks.join("\n")
    }
    //getDetatils
    let page = Number(urlP.get("page")) || 1
    let currentPageIds = productIds.slice((page-1)*LIMIT, page*LIMIT)
    let products = await queryApi({
        "action": "get_items",
        "params": {"ids": currentPageIds}
    })
    //remove duplicated products
    products = products.filter((elem, index, arr) => arr.findIndex(e => e.id === elem.id) === index) 
    renderProducts(products.slice(0, LIMIT))
    loading.hidden = true
}

function prodTemplate(prod) {
    n = productTemplate
    n.hidden = false
    n = n.outerHTML
    for(key of Object.keys(prod)) {
        n = n.replace(`{${key}}`, prod[key])
    }

    return n
}

function renderProducts(products) {
    let prodElem = []
    for(prod of products) {
        let res = prodTemplate(prod)
        prodElem.push(res)
    }

    productsContainer.innerHTML = prodElem.join("\n")
}

function initPagination() {
    pageNumber.innerHTML = urlP.get("page") || 1

    pagination.addEventListener("click", (e) => {
        e.preventDefault()
        let page = e.srcElement.getAttribute("href")
        let same_page = page == urlP.get("page")
        if(e.srcElement.tagName !== "A" || same_page) return

        urlP.set("page", page)
        //update url
        const newUrl = new URL(window.location)
        newUrl.searchParams.set("page", page)
        window.history.pushState({}, '', newUrl)
    })
}

async function initFilters() {
    let filterInputs = document.querySelectorAll(".filter-types input, .filter-types select")

    //init from url params 
    for(f of filterInputs) {
        if(urlP.has(f.name))
        {
            activeFilter.value = f.name
            f.hidden = false
            let tmp = urlP.get(f.name)
            if(f.tagName == "SELECT")
                f.add(new Option(tmp, tmp))
            f.value = tmp
            break
        }
    }

    activeFilter.addEventListener("change", (e) => {
        let newActiveFilter = e.target.value
        //filterInputs.forEach((f) => f.name == activeFilter ? f.hidden = false : f.hidden = true )
        filterInputs.forEach((f) => {
            if(f.name != newActiveFilter) {
                f.hidden = true
                f.value = ""
            } else {
                f.hidden = false
            }
        })
    })

    filtersForm.addEventListener("submit", (e) => {
        e.preventDefault()
        let fd = new FormData(filtersForm)
        let paramName = activeFilter.value
        let paramValue = fd.get(paramName)
        productIds = []// we don't need old id's anymore

        //update url
        const newUrl = new URL(window.location)
        newUrl.search = ""

        if(e.submitter.id == "apply") {
            newUrl.searchParams.set(paramName, paramValue)
        } else {
            filtersForm.reset()
            filterInputs.forEach((f) => f.hidden = true)
        }
        window.history.pushState({}, '', newUrl)
    })

    let datalists = Array.from(filtersForm.getElementsByTagName("datalist"))
    datalists.push(document.getElementById("brand"))
    //get values for filter autocomplete
    for(d of datalists) {
        let brands = await queryApi({
            "action": "get_fields",
            "params": {"field": d.id}
        })
        brands = [... new Set(brands)]
        //wrap in 'option' tags
        brands = brands.map((b) => {
            let o = document.createElement("option")
            o.value = b
            if(d.tagName == "SELECT")
                o.text = b
            return  o.outerHTML
        })
        d.innerHTML += brands.join("\n")
    }
}

window.addEventListener("load", function() {
    password = generatePassword()
    urlP = new URLSearchParams(document.location.search)

    productTemplate = document.getElementById("product-template")
    productsContainer = document.getElementById("main-products")

    filtersForm = document.getElementById("filters-form")
    activeFilter = document.getElementById("active-filter")

    pageNumber = document.getElementById("page-number")
    pagination = document.getElementById("pagination")

    initFilters()
    initPagination()

    fetchProducts()
})

window.navigation.addEventListener("navigate", (e) => {
    console.log("Location changed, ", e)
    urlP = new URL(e.destination.url).searchParams

    //update 'current page' text
    pageNumber.innerHTML = urlP.get("page") || 1

    fetchProducts()
})

