const { handleErr } = require('./helpers')

class Store {
    constructor(db) {
        this.db = db;
    }

    async userExists(username) {
        const userExistsQ = `SELECT 1 AS exists FROM users WHERE name = $1;`

        try {
            const res = await this.db.query(userExistsQ, [username])
            return res.rows.length > 0
        } catch (e) {
            console.log(e)
            throw e
        }
    }

    async isAdmin(username) {
        const userExistsQ = `SELECT is_admin AS isadmin FROM users WHERE name = $1;`

        try {
            const res = await this.db.query(userExistsQ, [username])
            return res.rows[0].isadmin
        } catch (e) {
            console.log(e)
            throw e
        }
    }

    async addUser(username) {
        const insertUserQ = `INSERT INTO users (name) VALUES ($1);`
        const insertAccountQ = `INSERT INTO accounts (username) VALUES ($1);`

        try {
            await this.db.query(`BEGIN`)
            await this.db.query(insertUserQ, [username])
            await this.db.query(insertAccountQ, [username])
            await this.db.query(`COMMIT`)
        } catch (e) {
            await this.db.query(`ROLLBACK`)
            console.log(e)
            throw e
        }
    }

    async accountBalance(username) {
        const balanceQ = `SELECT balance FROM accounts WHERE username = $1;`

        try {
            const res = await this.db.query(balanceQ, [username])
            return res.rows[0].balance
        } catch (e) {
            console.log(e)
        }
    }

    async buy(username, ticker, price, shares, assetType) {
        let ownedStockQ = `INSERT INTO owned_stocks (username, ticker, shares, asset_type) VALUES ($1, $2, $3, $4) ON CONFLICT (username, ticker) DO UPDATE SET shares = owned_stocks.shares + $3;`
        let tradesQ = `INSERT INTO trades (username, ticker, price, shares, type, asset_type) VALUES ($1, $2, $3, $4, 'buy', $5);`
        let accountQ = `UPDATE accounts SET balance = (balance - $1) WHERE username = $2;`

        try {
            await this.db.query(`BEGIN`)
            await this.db.query(ownedStockQ, [username, ticker, shares, assetType])
            await this.db.query(tradesQ, [username, ticker, price, shares, assetType])
            await this.db.query(accountQ, [(shares*price), username])
            await this.db.query(`COMMIT`)
        } catch(e) {
            await this.db.query(`ROLLBACK`)
            console.log(e)
            throw e
        }
    }

    async deleteUser(username) {
        let deleteUserQ = `DELETE FROM users WHERE name = $1;`

        try {
            await this.db.query(deleteUserQ, [username])
        } catch (e) {
            console.log(e)
            throw e
        }
    }

    async fetchOwnedShares(username, ticker) {
        let selectStockQ = `SELECT shares FROM owned_stocks WHERE username = $1 AND ticker = $2;`

        try {
            const res = await this.db.query(selectStockQ, [username, ticker])
            if (res.rows.length > 0) {
                return res.rows[0].shares
            }
            return 0
        } catch (e) {
            console.log(e)
            throw e
        }
    }

    async sell(username, ticker, price, shares) {
        let ownedStockQ = `UPDATE owned_stocks SET shares=(shares - $1) WHERE username = $2 AND ticker = $3;`
        let tradesQ = `INSERT INTO trades (username, ticker, price, shares, type) VALUES ($1, $2, $3, $4, 'sell');`
        let accountQ = `UPDATE accounts SET balance = (balance + $1) WHERE username = $2;`

        try {
            await this.db.query(`BEGIN`)
            await this.db.query(ownedStockQ, [shares, username, ticker])
            await this.db.query(tradesQ, [username, ticker, price, shares])
            await this.db.query(accountQ, [(shares*price), username])
            await this.db.query(`COMMIT`)
        } catch(e) {
            await this.db.query(`ROLLBACK`)
            console.log(e)
            throw e
        }
    }

    async getAssets(username) {
        const getStocksQ = `SELECT ticker, shares, asset_type AS assettype FROM owned_stocks WHERE username = $1;`

        try {
            const res = await this.db.query(getStocksQ, [username])
            return res.rows.map((row) => {
                return { ticker: row.ticker, shares: row.shares, type: row.assettype }
            })
        } catch(e) {
            console.log(e)
            throw e
        }
    }

    async getTradeHistory(username) {
        const getStocksQ = `SELECT ticker, shares, type, price FROM trades WHERE username = $1;`

        try {
            const res = await this.db.query(getStocksQ, [username])
            return res.rows.map((row) => {
                return {
                    ticker: row.ticker,
                    shares: row.shares,
                    type: row.type,
                    price: row.price,
                }
            })
        } catch(e) {
            console.log(e)
            throw e
        }
    }

  //async getAllUsersAndAssets() {
    //const q = `SELECT u.username, o.ticker, o.shares, o.asset_type AS assettype, a.balance FROM users u
    //JOIN accounts a ON u.username = a.username
    //JOIN owned_stocks o ON o.username = u.username;`

    //// join the users, owned_stocks, and accounts
    //try {

      //const res = await this.db.query(q)
      //const assets = res.rows.map((row) => {
        //return {
          //ticker: row.ticker,
          //shares: row.shares,
          //assettype: row.assettype,
          //balance: row.balance,
          //username: row.username,
        //}
      //})
    //} catch (e) {
        //console.log(e)
        //throw e
    //}
  //}
  async getAllUsers() {
    const userQ = `SELECT name from users;`

    try {
      const res = await this.db.query(userQ)
      return res.rows.map((row) => {
        return {
          username: row.name,
        }
      })
    } catch (e) {
        console.log(e)
        throw e
    }
  }
}

exports.Store = Store
