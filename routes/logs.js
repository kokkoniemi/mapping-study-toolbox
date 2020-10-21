const db = require("../models");

const listing = (req, res) => {
    let { offset, limit } = req.query;
    offset = !offset ? 0 : parseInt(offset);
    limit = !limit ? 25 : parseInt(limit);

    return db.ActivityLog.count({}).then(count => {
        db.ActivityLog.findAll({
            offset,
            limit,
            include: db.Record,
            order: [
                ['id', 'DESC']
            ]
        }).then((logs) => res.send({ count, logs }))
    })
        .catch((err) => res.send(err));
};

module.exports = {
    listing
};
