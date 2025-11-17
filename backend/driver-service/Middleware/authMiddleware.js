const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.userId) {
        console.log("User session:", req.session.user);
        return next();
    }

    return res.status(401).json({
        message: 'You must be logged in to access this resource'
    });
};

module.exports = isAuthenticated;
